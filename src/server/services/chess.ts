import 'server-only'
import { z } from 'zod'
import { Chess, type Move, type Square } from 'chess.js'
import {
  LIFE_AREAS,
  type BoardEdit,
  type ChessHistoryItem,
  type ChessMode,
  type ChessMoveView,
  type ChessStatus,
  type ChessView,
  type CommentView,
  type DealKind,
  type DealOutcome,
  type DealView,
  type EndReason,
  type MomentKind,
} from '@/lib/chess/types'
import { opponentByKey, OPPONENTS } from '@/lib/chess/opponents'
import { isTerminal, type Terms, type Turn } from '@/lib/negotiation/types'
import { formatTerms, rapportLabel } from '@/lib/negotiation/format'
import { getDb } from '../db'
import type { ChessGameDoc } from '../db/models'
import type { SessionUser } from '../auth/session'
import { AppError, Errors } from '../http'
import { chooseMove, scorePosition, VALUES } from '../chess/bot'
import { classicComment, classifyTurn, hashSeed, pickScene, type HalfMove, type TurnFacts } from '../chess/moments'
import { sceneByKey, type SceneDef } from '../chess/scenes'
import { buildDealContext, dealDescription, dealLesson, dealTitle, drawAccepted, openingLine, planQueenTrade, planTakeback, removalFor, wantsQueenTrade, type DealSpec } from '../chess/deals'
import { availableQuestions, availableStatements, initialState, step, type PlayerAction, type StepResult } from '../engine/engine'
import { narrateTurn } from '../ai/chess-narrator'
import { AiUnavailableError } from '../ai/providers'
import { aiAvailable } from './flags'
import { actionSchema, aiWordedStep } from './games'
import { assertAiQuota, recordUsage } from './usage'
import { enforce, RateLimitedError, RULES } from '../security/rate-limit'

/**
 * Life Chess. The server is the only authority on the board: it validates
 * every player move with chess.js, plays the bot's reply, classifies the
 * turn into life moments and picks at most one life scene. Deals (takebacks,
 * queen trades, draws) are negotiated with the shared negotiation engine and
 * change the board only when agreed. AI mode only re-words text.
 */

const square = z.string().regex(/^[a-h][1-8]$/)

const dealActionSchema = actionSchema.refine((a) => a.type !== 'PAUSE' && a.type !== 'RESUME', 'Deals cannot be paused.')

export const chessActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('MOVE'), from: square, to: square, promotion: z.enum(['q', 'r', 'b', 'n']).optional() }),
  z.object({ type: z.literal('CHOOSE'), sceneId: z.string().regex(/^[0-9a-f-]{36}$/i), optionKey: z.string().regex(/^[a-z0-9-]{1,40}$/) }),
  z.object({ type: z.literal('RESIGN') }),
  z.object({ type: z.literal('DEAL_REQUEST'), kind: z.enum(['TAKEBACK', 'DRAW']) }),
  z.object({ type: z.literal('DEAL'), action: dealActionSchema }),
])

export const chessActionRequestSchema = z.object({
  action: chessActionSchema,
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Invalid idempotency key.'),
  expectedVersion: z.number().int().nonnegative().optional(),
})

export const chessStartSchema = z.object({
  opponent: z.string().refine((k) => Boolean(opponentByKey(k)), 'Choose an opponent.'),
  mode: z.enum(['CLASSIC', 'AI']).default('CLASSIC'),
  color: z.enum(['w', 'b', 'random']).default('w'),
})

export const chessModeSchema = z.object({ mode: z.enum(['CLASSIC', 'AI']) })

const MAX_KEYS = 60
const CONFLICT = 'This game changed in another tab. Reload to continue.'
const MAX_TAKEBACKS = 2
const MAX_DRAW_OFFERS = 3

type Game = ChessGameDoc
type DealRecord = Game['deals'][number]
type ActiveDeal = NonNullable<Game['deal']>

async function ownedChess(userId: string, id: string): Promise<Game> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound('Game')
  const game = await (await getDb()).chessGames.findOne({ _id: id, userId })
  if (!game) throw Errors.notFound('Game')
  // Games created before deals existed.
  game.edits ??= []
  game.deals ??= []
  game.deal ??= null
  return game
}

/** Rebuild the position: moves in order, skipping taken-back ones, with negotiated removals at their place. */
function replay(moves: ChessMoveView[], edits: BoardEdit[]): Chess {
  let c = new Chess()
  const applyEdits = (i: number) => {
    const due = edits.filter((e) => e.afterMove === i)
    if (!due.length) return
    for (const e of due) for (const sq of e.remove) c.remove(sq as Square)
    c = new Chess(c.fen())
  }
  for (const [i, m] of moves.entries()) {
    applyEdits(i)
    if (!m.undone) c.move({ from: m.from, to: m.to, promotion: m.promotion })
  }
  applyEdits(moves.length)
  return c
}

const replayGame = (g: Pick<Game, 'moves' | 'edits'>) => replay(g.moves, g.edits)

function toView(m: Move, ply: number): ChessMoveView {
  return {
    ply,
    color: m.color,
    san: m.san,
    from: m.from,
    to: m.to,
    piece: m.piece,
    ...(m.captured ? { captured: m.captured } : {}),
    ...(m.promotion ? { promotion: m.promotion } : {}),
    flags: m.flags,
    check: /[+#]$/.test(m.san),
  }
}

function half(m: Move): HalfMove {
  return { piece: m.piece, captured: m.captured, promotion: m.promotion, flags: m.flags, check: /[+#]$/.test(m.san), san: m.san }
}

function material(c: Chess, color: 'w' | 'b'): number {
  let s = 0
  for (const row of c.board()) for (const p of row) if (p) s += (p.color === color ? 1 : -1) * VALUES[p.type]
  return s / 100
}

function isEndgame(c: Chess): boolean {
  let m = 0
  for (const row of c.board()) for (const p of row) if (p && p.type !== 'k' && p.type !== 'p') m += VALUES[p.type]
  return m <= 2600
}

/** Result from the player's point of view, or null while the game continues. */
function outcome(c: Chess, player: 'w' | 'b'): { status: ChessStatus; reason: EndReason } | null {
  if (c.isCheckmate()) return { status: c.turn() === player ? 'LOST' : 'WON', reason: 'CHECKMATE' }
  if (c.isStalemate()) return { status: 'DRAWN', reason: 'STALEMATE' }
  if (c.isInsufficientMaterial()) return { status: 'DRAWN', reason: 'INSUFFICIENT' }
  if (c.isThreefoldRepetition()) return { status: 'DRAWN', reason: 'REPETITION' }
  if (c.isDrawByFiftyMoves()) return { status: 'DRAWN', reason: 'FIFTY_MOVE' }
  return null
}

const playerMoveCount = (g: Game) => g.moves.filter((m) => m.color === g.playerColor).length

function sceneHistory(g: Game) {
  return g.scenes.map((s) => ({ kind: s.kind, sceneKey: s.sceneKey, playerMoveNumber: s.playerMoveNumber }))
}

function finalScene(g: Game, kind: 'WIN' | 'LOSE' | 'DRAW'): Game['scenes'][number] | null {
  const n = playerMoveCount(g)
  const scene = pickScene([kind], sceneHistory(g), n, hashSeed(`${g._id}:${g.moves.length}:${kind}`))
  return scene ? { id: crypto.randomUUID(), ply: g.moves.length, kind, sceneKey: scene.key, playerMoveNumber: n, body: scene.body, source: 'rules', chosenKey: null } : null
}

// ── Deal eligibility ────────────────────────────────────────────────────────

/** A takeback undoes the player's move and the bot's reply: both must be the latest, live moves. */
function takebackWindow(g: Game): boolean {
  const n = g.moves.length
  const [p, b] = [g.moves[n - 2], g.moves[n - 1]]
  return (
    g.status === 'ACTIVE' &&
    !g.deal &&
    n >= 2 &&
    p?.color === g.playerColor &&
    b?.color !== g.playerColor &&
    !p.undone &&
    !b?.undone &&
    !g.edits.some((e) => e.afterMove >= n - 1) &&
    g.deals.filter((d) => d.kind === 'TAKEBACK').length < MAX_TAKEBACKS
  )
}

function takebackPlan(g: Game, by: 'player' | 'opponent'): DealSpec | null {
  if (!takebackWindow(g)) return null
  const now = replayGame(g)
  const undone = g.moves.map((m, i) => (i >= g.moves.length - 2 ? { ...m, undone: true } : m))
  const back = replay(undone, g.edits)
  const swing = material(back, g.playerColor) - material(now, g.playerColor)
  return planTakeback(back.fen(), g.playerColor, opponentByKey(g.opponentKey)!, swing, by)
}

function drawWindow(g: Game, c: Chess): boolean {
  const offers = g.deals.filter((d) => d.kind === 'DRAW')
  const last = offers.at(-1)
  return g.status === 'ACTIVE' && !g.deal && c.turn() === g.playerColor && playerMoveCount(g) >= 10 && offers.length < MAX_DRAW_OFFERS && (!last || g.moves.length - last.ply >= 6)
}

function openDeal(g: Game, spec: DealSpec, now: Date): ActiveDeal {
  const op = opponentByKey(g.opponentKey)!
  const ctx = buildDealContext(spec, op)
  const state = initialState(ctx)
  const opening: Terms = { pawns: spec.opening }
  state.counterOffer = opening
  state.offers.push({ turn: 0, terms: opening, by: 'counterpart' })
  state.phase = 'BARGAINING'
  const at = now.toISOString()
  const turns: Turn[] = []
  if (spec.by === 'player') turns.push({ idx: 0, at, actor: 'player', action: 'MESSAGE', text: 'Could I take that move back?' })
  turns.push({ idx: turns.length, at, actor: 'counterpart', action: 'COUNTER', text: openingLine(spec, formatTerms(ctx.pub.issues, opening)), offer: opening, source: 'rules' })
  return { id: crypto.randomUUID(), kind: spec.kind, by: spec.by, ply: g.moves.length, spec, state, turns }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

export async function startChess(user: SessionUser, input: z.infer<typeof chessStartSchema>): Promise<{ id: string }> {
  const op = opponentByKey(input.opponent)!
  if (input.mode === 'AI' && !(await aiAvailable())) throw new AppError(503, 'AI_UNAVAILABLE', 'AI narration is not available right now. Classic mode is fully playable.')
  const playerColor = input.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : input.color
  const c = new Chess()
  const now = new Date()
  const moves: ChessMoveView[] = []
  const comments: CommentView[] = []
  if (playerColor === 'b') {
    const bm = chooseMove(c.fen(), op.level)!
    moves.push(toView(c.move(bm), 0))
    comments.push({ ply: 0, text: `${moves[0]!.san}. I will start. Show me how you respond.`, source: 'rules' })
  }
  const game: Game = {
    _id: crypto.randomUUID(),
    userId: user.id,
    opponentKey: op.key,
    level: op.level,
    mode: input.mode,
    playerColor,
    status: 'ACTIVE',
    endReason: null,
    fen: c.fen(),
    moves,
    comments,
    scenes: [],
    edits: [],
    deal: null,
    deals: [],
    processedKeys: [],
    version: 0,
    aiUsage: { calls: 0, inputTokens: 0, outputTokens: 0 },
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }
  await (await getDb()).chessGames.insertOne(game)
  return { id: game._id }
}

type Narrated = { comment: CommentView; sceneBody: string | null; sceneSource: CommentView['source']; usage: { inputTokens: number; outputTokens: number }; notice: string | null }

/** Gate an AI call on availability, rate limit and quota; on any of those, say why so the caller can fall back. */
async function aiGate(user: SessionUser, game: Game): Promise<{ ok: true } | { ok: false; notice: string | null }> {
  if (game.mode !== 'AI') return { ok: false, notice: null }
  if (!(await aiAvailable())) return { ok: false, notice: 'AI is turned off right now, so this turn uses Classic text.' }
  try {
    await enforce(RULES.aiTurn, user.id)
    await assertAiQuota(user.id, user.plan)
    return { ok: true }
  } catch (err) {
    if (err instanceof RateLimitedError) return { ok: false, notice: 'AI is busy for a moment, so this turn uses Classic text.' }
    if (err instanceof AppError && err.code === 'AI_QUOTA') return { ok: false, notice: err.message }
    throw err
  }
}

/** AI mode wording with graceful fallback: the move always stands, only the words change. */
async function narrate(user: SessionUser, game: Game, c: Chess, facts: TurnFacts, kinds: MomentKind[], scene: SceneDef | null, fallback: string, ply: number): Promise<Narrated> {
  const rules: Narrated = { comment: { ply, text: fallback, source: 'rules' }, sceneBody: null, sceneSource: 'rules', usage: { inputTokens: 0, outputTokens: 0 }, notice: null }
  const gate = await aiGate(user, game)
  if (!gate.ok) return { ...rules, notice: gate.notice }
  const op = opponentByKey(game.opponentKey)!
  try {
    const out = await narrateTurn({
      opponent: op,
      recentSan: c.history(),
      playerMove: { san: facts.player.san, area: LIFE_AREAS[facts.player.piece].area.toLowerCase() },
      botMove: facts.bot ? { san: facts.bot.san, area: LIFE_AREAS[facts.bot.piece].area.toLowerCase() } : null,
      moments: kinds,
      scene: scene ? { title: scene.title, setting: scene.setting, body: scene.body, lesson: scene.lesson } : null,
      fallbackComment: fallback,
    })
    await recordUsage(user.id, 'AI_TURN', out.usage, !out.fallback)
    const source: CommentView['source'] = out.fallback ? 'rules' : out.usage.provider === 'mock' ? 'mock-ai' : 'ai'
    return {
      comment: { ply, text: out.narration.comment, source },
      sceneBody: out.narration.sceneBody,
      sceneSource: out.narration.sceneBody ? source : 'rules',
      usage: { inputTokens: out.usage.inputTokens, outputTokens: out.usage.outputTokens },
      notice: out.fallback ? 'The AI reply could not be validated, so Classic text was used.' : null,
    }
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      await recordUsage(user.id, 'AI_TURN', { provider: 'unknown', model: 'unknown', inputTokens: 0, outputTokens: 0 }, false)
      return { ...rules, notice: 'The AI narrator is unavailable right now, so this turn uses Classic text. You can switch to Classic mode any time.' }
    }
    throw err
  }
}

export async function submitChessAction(user: SessionUser, id: string, req: z.infer<typeof chessActionRequestSchema>): Promise<ChessView> {
  const game = await ownedChess(user.id, id)
  if (game.processedKeys.includes(req.idempotencyKey)) return getChessView(user, id)
  if (req.expectedVersion !== undefined && req.expectedVersion !== game.version) throw Errors.conflict(CONFLICT)
  const a = req.action

  if (a.type === 'CHOOSE') {
    const idx = game.scenes.findIndex((s) => s.id === a.sceneId)
    const sc = game.scenes[idx]
    if (!sc) throw Errors.notFound('Scene')
    if (sc.chosenKey) throw Errors.conflict('You already chose a response for this scene.')
    if (!sceneByKey(sc.sceneKey)?.options.some((o) => o.key === a.optionKey)) throw Errors.invalid('Choose one of the listed responses.')
    const scenes = game.scenes.map((s, i) => (i === idx ? { ...s, chosenKey: a.optionKey } : s))
    await write(game, { scenes }, req.idempotencyKey, {})
    return getChessView(user, id)
  }

  if (game.status !== 'ACTIVE') throw Errors.conflict('This game has already ended.')
  if (a.type === 'DEAL_REQUEST') return requestDeal(user, game, a.kind, req.idempotencyKey)
  if (a.type === 'DEAL') return dealStep(user, game, a.action as PlayerAction, req.idempotencyKey)

  const op = opponentByKey(game.opponentKey)!
  const c = replayGame(game)
  const seed = hashSeed(`${game._id}:${game.moves.length}`)
  const history = sceneHistory(game)
  const playerMoveNumber = playerMoveCount(game) + 1

  if (a.type === 'RESIGN') {
    const scene = finalScene(game, 'LOSE')
    const now = new Date()
    const set: Partial<Game> = { status: 'LOST', endReason: 'RESIGNATION', completedAt: now }
    // An open deal ends with the game.
    if (game.deal) Object.assign(set, closeDeal(game, game.deal, 'DECLINED', null))
    await write(game, set, req.idempotencyKey, {
      comments: [{ ply: game.moves.length, text: 'You resigned. Knowing when to stop is a skill too. Good game.', source: 'rules' }],
      scenes: scene ? [scene] : [],
    })
    return getChessView(user, id)
  }

  if (game.deal) throw Errors.conflict('Settle the deal on the table first: accept, counter or walk away.')
  if (c.turn() !== game.playerColor) throw Errors.conflict('Wait for your opponent to move.')
  const before = material(c, game.playerColor)
  const endgameBefore = isEndgame(c)
  let pm: Move
  try {
    pm = c.move({ from: a.from, to: a.to, promotion: a.promotion })
  } catch {
    throw Errors.invalid('That move is not legal in this position.')
  }
  const newMoves = [toView(pm, game.moves.length)]
  let result = outcome(c, game.playerColor)
  let bm: Move | null = null
  if (!result) {
    const pick = chooseMove(c.fen(), game.level)!
    bm = c.move(pick)
    newMoves.push(toView(bm, game.moves.length + 1))
    result = outcome(c, game.playerColor)
  }
  const facts: TurnFacts = {
    player: half(pm),
    bot: bm ? half(bm) : null,
    materialBefore: before,
    materialAfter: material(c, game.playerColor),
    playerMoveNumber,
    enteredEndgame: !endgameBefore && isEndgame(c) && !history.some((h) => h.kind === 'ENDGAME'),
    status: result?.status ?? 'ACTIVE',
  }
  const kinds = classifyTurn(facts)
  const scene = pickScene(kinds, history, playerMoveNumber, seed)
  const lastPly = game.moves.length + newMoves.length - 1
  const n = await narrate(user, game, c, facts, kinds, scene, classicComment(op, kinds, facts, seed), lastPly)
  const now = new Date()
  const set: Partial<Game> = { fen: c.fen() }
  if (result) Object.assign(set, { status: result.status, endReason: result.reason, completedAt: now })

  // The opponent may put a deal on the table after its reply.
  if (!result && bm) {
    const after: Game = { ...game, moves: [...game.moves, ...newMoves] }
    let spec: DealSpec | null = null
    if (kinds.includes('BLUNDER') && op.level <= 2) spec = takebackPlan(after, 'opponent')
    if (!spec && !game.deals.some((d) => d.kind === 'QUEEN_TRADE') && wantsQueenTrade(op, -facts.materialAfter, playerMoveNumber)) spec = planQueenTrade(c.fen(), game.playerColor, op, -facts.materialAfter)
    if (spec) set.deal = openDeal(after, spec, now)
  }
  await write(game, set, req.idempotencyKey, {
    moves: newMoves,
    comments: [n.comment],
    scenes: scene ? [{ id: crypto.randomUUID(), ply: lastPly, kind: scene.kind, sceneKey: scene.key, playerMoveNumber, body: n.sceneBody ?? scene.body, source: n.sceneSource, chosenKey: null }] : [],
    aiUsage: n.usage,
  })
  return { ...(await getChessView(user, id)), notice: n.notice }
}

// ── Deals ───────────────────────────────────────────────────────────────────

async function requestDeal(user: SessionUser, game: Game, kind: 'TAKEBACK' | 'DRAW', key: string): Promise<ChessView> {
  const op = opponentByKey(game.opponentKey)!
  const now = new Date()
  if (kind === 'TAKEBACK') {
    if (!takebackWindow(game)) throw Errors.conflict('A takeback is only possible right after your opponent replies, and twice per game at most.')
    const spec = takebackPlan(game, 'player')
    if (!spec) throw Errors.conflict('There is nothing on your side of the board to pay for a takeback with.')
    await write(game, { deal: openDeal(game, spec, now) }, key, {})
    return getChessView(user, game._id)
  }

  const c = replayGame(game)
  if (!drawWindow(game, c)) throw Errors.conflict('You can offer a draw on your move from move 10, up to three times, with a few moves between offers.')
  // The side to move is the player, so the bot's view is the negated score.
  const accepted = drawAccepted(op.level, -scorePosition(c.fen()))
  const record: DealRecord = {
    id: crypto.randomUUID(),
    kind: 'DRAW',
    by: 'player',
    ply: game.moves.length,
    outcome: accepted ? 'AGREED' : 'DECLINED',
    terms: null,
    termsText: null,
    lesson: dealLesson('DRAW', accepted ? 'AGREED' : 'DECLINED', null, null),
    turns: [],
  }
  const text = accepted
    ? { sam: 'A draw? Sure, fair result.', dana: 'Agreed. Neither of us is getting more out of this one.', victor: 'Accepted. A sensible outcome.' }[op.key]!
    : { sam: 'Nah, I think I have something here. Let us play on.', dana: 'Not yet. I think I can still get more from this position.', victor: 'No. I am playing for the win.' }[op.key]!
  const set: Partial<Game> = { deals: [...game.deals, record] }
  const scene = accepted ? finalScene(game, 'DRAW') : null
  if (accepted) Object.assign(set, { status: 'DRAWN', endReason: 'AGREEMENT', completedAt: now })
  await write(game, set, key, { comments: [{ ply: game.moves.length, text, source: 'rules' }], scenes: scene ? [scene] : [] })
  return getChessView(user, game._id)
}

const OUTCOME_OF: Record<string, DealOutcome> = { AGREEMENT_REACHED: 'AGREED', WALKED_AWAY: 'DECLINED' }

/** Fields that end the active deal and file it in the history. */
function closeDeal(game: Game, deal: ActiveDeal, outcome: DealOutcome, terms: Terms | null, turns: Turn[] = deal.turns): Partial<Game> {
  const ctx = buildDealContext(deal.spec, opponentByKey(game.opponentKey)!)
  const record: DealRecord = {
    id: deal.id,
    kind: deal.kind,
    by: deal.by,
    ply: deal.ply,
    outcome,
    terms,
    termsText: terms ? formatTerms(ctx.pub.issues, terms) : null,
    lesson: dealLesson(deal.kind, outcome, deal.spec, terms),
    turns,
  }
  return { deal: null, deals: [...game.deals, record] }
}

async function dealStep(user: SessionUser, game: Game, action: PlayerAction, key: string): Promise<ChessView> {
  const deal = game.deal
  if (!deal) throw Errors.conflict('There is no deal on the table.')
  const op = opponentByKey(game.opponentKey)!
  const ctx = buildDealContext(deal.spec, op)
  let res: StepResult
  let notice: string | null = null
  let usage = { inputTokens: 0, outputTokens: 0 }
  const worded = action.type === 'MESSAGE' || action.type === 'MAKE_OFFER' || action.type === 'REQUEST_CONCESSION' || action.type === 'REJECT'
  if (worded && game.mode === 'AI' && (await aiAvailable())) {
    // aiWordedStep enforces the AI rate limit and quota itself.
    try {
      const out = await aiWordedStep(user, deal, ctx, action)
      res = out.res
      usage = out.usage
    } catch (err) {
      const soft = err instanceof RateLimitedError || (err instanceof AppError && (err.code === 'AI_UNAVAILABLE' || err.code === 'AI_QUOTA'))
      if (!soft) throw err
      res = step(ctx, deal.state, action)
      notice = err instanceof AppError && err.code === 'AI_QUOTA' ? err.message : 'The AI character is unavailable right now, so this reply follows the deal rules.'
    }
  } else {
    res = step(ctx, deal.state, action)
    if (worded && game.mode === 'AI') notice = 'AI is turned off right now, so this reply follows the deal rules.'
  }
  const now = new Date()
  const turns = [...deal.turns, ...res.turns.map((t, i) => ({ ...t, idx: deal.turns.length + i, at: now.toISOString() }))]
  const set: Partial<Game> = {}
  const comments: CommentView[] = []

  if (!isTerminal(res.status)) {
    set.deal = { ...deal, state: res.state, turns }
  } else {
    const settled = OUTCOME_OF[res.status] ?? 'NO_DEAL'
    const terms = settled === 'AGREED' ? (res.outcome?.terms ?? null) : null
    Object.assign(set, closeDeal(game, deal, settled, terms, turns))
    if (settled === 'AGREED' && terms) {
      const n = game.moves.length
      if (deal.kind === 'TAKEBACK') set.moves = game.moves.map((m, i) => (i >= n - 2 ? { ...m, undone: true } : m))
      set.edits = [...game.edits, { afterMove: n, remove: removalFor(deal.spec, terms), reason: deal.kind }]
      const c = replay(set.moves ?? game.moves, set.edits)
      set.fen = c.fen()
      const result = outcome(c, game.playerColor)
      if (result) Object.assign(set, { status: result.status, endReason: result.reason, completedAt: now })
    }
    const last = [...res.turns].reverse().find((t) => t.actor === 'counterpart')
    comments.push({
      ply: game.moves.length,
      text: last?.text ?? (settled === 'AGREED' ? ctx.priv.counterpart.lines.accept : settled === 'DECLINED' ? 'Fair enough. We play on.' : 'No deal, then. Your move.'),
      source: last?.source ?? 'rules',
    })
  }
  await write(game, set, key, { comments, aiUsage: usage })
  return { ...(await getChessView(user, game._id)), notice }
}

/** Version-guarded append; a concurrent write or replayed key surfaces as a conflict or the stored result. */
async function write(
  game: Game,
  set: Partial<Game>,
  key: string,
  push: { moves?: ChessMoveView[]; comments?: CommentView[]; scenes?: Game['scenes']; aiUsage?: { inputTokens: number; outputTokens: number } },
) {
  const db = await getDb()
  const inc: Record<string, number> = { version: 1 }
  if (push.aiUsage && (push.aiUsage.inputTokens || push.aiUsage.outputTokens)) {
    inc['aiUsage.calls'] = 1
    inc['aiUsage.inputTokens'] = push.aiUsage.inputTokens
    inc['aiUsage.outputTokens'] = push.aiUsage.outputTokens
  }
  const $push: Record<string, unknown> = { processedKeys: { $each: [key], $slice: -MAX_KEYS } }
  if (push.moves?.length && !set.moves) $push.moves = { $each: push.moves }
  if (push.comments?.length) $push.comments = { $each: push.comments }
  if (push.scenes?.length && !set.scenes) $push.scenes = { $each: push.scenes }
  const r = await db.chessGames.updateOne({ _id: game._id, userId: game.userId, version: game.version }, { $set: { ...set, updatedAt: new Date() }, $inc: inc, $push } as never)
  if (!r.matched) {
    const fresh = await ownedChess(game.userId, game._id)
    if (!fresh.processedKeys.includes(key)) throw Errors.conflict(CONFLICT)
  }
}

export async function setChessMode(user: SessionUser, id: string, mode: ChessMode): Promise<ChessView> {
  const game = await ownedChess(user.id, id)
  if (game.mode === mode) return getChessView(user, id)
  if (mode === 'AI' && !(await aiAvailable())) throw new AppError(503, 'AI_UNAVAILABLE', 'AI narration is not available right now. Classic mode is fully playable.')
  const r = await (await getDb()).chessGames.updateOne({ _id: game._id, userId: user.id, version: game.version }, { $set: { mode, updatedAt: new Date() }, $inc: { version: 1 } })
  if (!r.matched) throw Errors.conflict(CONFLICT)
  return getChessView(user, id)
}

function buildDealView(game: Game, deal: ActiveDeal): DealView {
  const op = opponentByKey(game.opponentKey)!
  const ctx = buildDealContext(deal.spec, op)
  const s = deal.state
  const classic = game.mode === 'CLASSIC'
  return {
    id: deal.id,
    kind: deal.kind,
    by: deal.by,
    title: dealTitle(deal.kind),
    description: dealDescription(deal.spec, op),
    issue: ctx.pub.issues[0]!,
    counterOffer: s.counterOffer,
    playerOffer: s.playerOffer,
    finalOffer: s.finalOfferIssued,
    rapport: rapportLabel(s.trust).label,
    turns: deal.turns,
    discovered: s.discovered.map((k) => ({ key: k, text: ctx.priv.counterpart.facts.find((f) => f.key === k)?.label ?? k })),
    questions: classic ? availableQuestions(ctx, s) : [],
    statements: classic ? availableStatements(ctx, s) : [],
  }
}

export function buildChessView(game: Game, ai: boolean): ChessView {
  const scenes = game.scenes.map((s) => {
    const def = sceneByKey(s.sceneKey)!
    const chosen = s.chosenKey ? def.options.find((o) => o.key === s.chosenKey) : undefined
    return {
      id: s.id,
      ply: s.ply,
      kind: s.kind,
      title: def.title,
      setting: def.setting,
      body: s.body,
      lesson: def.lesson,
      options: def.options.map((o) => ({ key: o.key, label: o.label })),
      chosen: chosen ? { key: chosen.key, outcome: chosen.outcome, quality: chosen.quality } : null,
      source: s.source,
    }
  })
  const c = game.status === 'ACTIVE' ? replayGame(game) : null
  return {
    id: game._id,
    status: game.status,
    endReason: game.endReason,
    mode: game.mode,
    aiAvailable: ai,
    version: game.version,
    opponent: opponentByKey(game.opponentKey) ?? OPPONENTS[0]!,
    playerColor: game.playerColor,
    fen: game.fen,
    moves: game.moves,
    comments: game.comments,
    scenes,
    lifeScore: { wise: scenes.filter((s) => s.chosen?.quality === 'wise').length, answered: scenes.filter((s) => s.chosen).length, total: scenes.length },
    edits: game.edits,
    deal: game.deal ? buildDealView(game, game.deal) : null,
    deals: game.deals.map((d) => ({ id: d.id, kind: d.kind as DealKind, by: d.by, ply: d.ply, outcome: d.outcome, terms: d.termsText, lesson: d.lesson })),
    can: { takeback: Boolean(c) && takebackPlan(game, 'player') !== null, draw: Boolean(c) && drawWindow(game, c!) },
    notice: null,
    createdAt: game.createdAt.toISOString(),
    completedAt: game.completedAt?.toISOString() ?? null,
  }
}

export async function getChessView(user: SessionUser, id: string): Promise<ChessView> {
  const [game, ai] = await Promise.all([ownedChess(user.id, id), aiAvailable()])
  return buildChessView(game, ai)
}

export async function listRecentChess(userId: string, limit = 6): Promise<ChessHistoryItem[]> {
  const docs = await (await getDb()).chessGames.find({ userId }, { sort: { createdAt: -1 }, limit, projection: { _id: 1, opponentKey: 1, status: 1, endReason: 1, moves: 1, mode: 1, createdAt: 1 } })
  return docs.map((g) => ({ id: g._id, opponent: opponentByKey(g.opponentKey)?.name ?? 'Opponent', status: g.status, endReason: g.endReason, moves: Math.ceil(g.moves.length / 2), mode: g.mode, createdAt: g.createdAt.toISOString() }))
}
