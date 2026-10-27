import 'server-only'
import { z } from 'zod'
import { isTerminal, type EngineState, type GameMode, type Terms, type Turn } from '@/lib/negotiation/types'
import { clampTerms, formatTerms, rapportLabel } from '@/lib/negotiation/format'
import type { GameView, HistoryItem } from '@/lib/negotiation/view'
import { getDb } from '../db'
import type { GameDoc, UserPreferencesDoc } from '../db/models'
import type { SessionUser } from '../auth/session'
import { Errors, AppError } from '../http'
import { availableQuestions, availableStatements, applySignalsTo, expire, initialState, openingTurns, step, type PlayerAction, type StepResult } from '../engine/engine'
import type { ScenarioContext } from '../engine/utility'
import { generateCharacterReply, type Decision } from '../ai/character'
import { AiUnavailableError } from '../ai/providers'
import { loadPlayableScenario, loadScenarioContext } from './scenarios'
import { aiAvailable } from './flags'
import { assertAiQuota, recordUsage } from './usage'
import { completeGame } from './completion'
import { isChallengeUnlocked } from './training'
import { enforce, RULES } from '../security/rate-limit'

const key = z.string().trim().min(1).max(40)

export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ASK'), questionKey: key }),
  z.object({ type: z.literal('STATEMENT'), statementKey: key }),
  z.object({ type: z.literal('MESSAGE'), text: z.string().trim().min(1, 'Write a message first.').max(1000, 'Keep messages under 1,000 characters.') }),
  z.object({ type: z.literal('MAKE_OFFER'), terms: z.record(z.string().max(40), z.number().finite()), message: z.string().trim().max(1000).optional() }),
  z.object({ type: z.literal('REQUEST_CONCESSION'), issueKey: key }),
  z.object({ type: z.literal('ACCEPT') }),
  z.object({ type: z.literal('REJECT') }),
  z.object({ type: z.literal('WALK_AWAY') }),
  z.object({ type: z.literal('PAUSE') }),
  z.object({ type: z.literal('RESUME') }),
])

export const actionRequestSchema = z.object({
  action: actionSchema,
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Invalid idempotency key.'),
  expectedVersion: z.number().int().nonnegative().optional(),
})

export const startSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,80}$/),
  mode: z.enum(['CLASSIC', 'AI']).default('CLASSIC'),
  variant: z.enum(['STANDARD', 'QUICK', 'CHALLENGE', 'ACADEMY', 'CUSTOM']).default('STANDARD'),
  timed: z.boolean().default(false),
  challengeSlug: z.string().regex(/^[a-z0-9-]{2,80}$/).optional(),
  lessonSlug: z.string().regex(/^[a-z0-9-]{2,80}$/).optional(),
})

export const prepSchema = z.union([
  z.object({ skip: z.literal(true) }),
  z.object({
    skip: z.literal(false).optional(),
    targets: z.record(z.string().max(40), z.number().finite()),
    walkAway: z.record(z.string().max(40), z.number().finite()),
    plan: z.string().trim().max(1000).optional(),
  }),
])

const MAX_KEYS = 60

async function ownedGame(userId: string, gameId: string): Promise<GameDoc> {
  if (!/^[0-9a-f-]{36}$/i.test(gameId)) throw Errors.notFound('Game')
  const db = await getDb()
  // Ownership is part of the query: other users' games are indistinguishable from missing ones.
  const game = await db.games.findOne({ _id: gameId, userId })
  if (!game) throw Errors.notFound('Game')
  return game
}

async function prefsFor(userId: string): Promise<UserPreferencesDoc | null> {
  return (await getDb()).preferences.findOne({ _id: userId })
}

export async function startGame(user: SessionUser, input: z.infer<typeof startSchema>): Promise<{ id: string }> {
  const db = await getDb()
  let slug = input.slug
  let challengeSlug: string | null = null
  if (input.variant === 'CHALLENGE') {
    const ch = await db.challenges.findOne({ slug: input.challengeSlug ?? '', published: true })
    if (!ch) throw Errors.notFound('Challenge')
    if (!(await isChallengeUnlocked(user.id, ch.slug))) throw new AppError(403, 'LOCKED', 'Pass the previous challenge to unlock this one.')
    slug = ch.scenarioSlug
    challengeSlug = ch.slug
  }
  let lessonSlug: string | null = null
  if (input.variant === 'ACADEMY' && input.lessonSlug) {
    const lesson = await db.lessons.findOne({ slug: input.lessonSlug, published: true })
    if (!lesson) throw Errors.notFound('Lesson')
    lessonSlug = lesson.slug
    if (lesson.practiceScenario) slug = lesson.practiceScenario
  }
  if (input.mode === 'AI') {
    if (!(await aiAvailable())) throw new AppError(503, 'AI_UNAVAILABLE', 'AI negotiation is not available right now. Classic mode is fully playable.')
    await assertAiQuota(user.id, user.plan)
  }
  const { doc, ver } = await loadPlayableScenario(slug, user.id)
  const ctx: ScenarioContext = { pub: ver.public, priv: ver.private }
  const now = new Date()
  const turns: Turn[] = openingTurns(ctx).map((t, idx) => ({ ...t, idx, at: now.toISOString() }))
  const game: GameDoc = {
    _id: crypto.randomUUID(),
    userId: user.id,
    scenarioId: doc._id,
    scenarioSlug: doc.slug,
    scenarioVersion: ver.version,
    scenarioTitle: doc.title,
    category: doc.category,
    difficulty: doc.difficulty,
    mode: input.mode,
    variant: doc.ownerId ? 'CUSTOM' : input.variant,
    status: 'CREATED',
    prep: null,
    state: initialState(ctx),
    turns,
    processedKeys: [],
    version: 0,
    timeLimitSec: input.timed ? ver.public.defaultTimeLimitSec : null,
    startedAt: null,
    deadlineAt: null,
    notes: '',
    outcome: null,
    score: null,
    challengeSlug,
    lessonSlug,
    replayOf: null,
    aiUsage: { calls: 0, inputTokens: 0, outputTokens: 0 },
    snapshots: [],
    pausedRemainingSec: null,
    progressApplied: false,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }
  await db.games.insertOne(game)
  return { id: game._id }
}

function validatePrepTerms(ctx: ScenarioContext, terms: Terms): Terms {
  const out = clampTerms(ctx.pub.issues, terms)
  if (Object.keys(out).length !== ctx.pub.issues.length) throw Errors.invalid('Set a value for every issue.')
  return out
}

export async function submitPrep(user: SessionUser, gameId: string, input: z.infer<typeof prepSchema>) {
  const game = await ownedGame(user.id, gameId)
  if (game.status !== 'CREATED') throw Errors.conflict('Preparation is already complete.')
  const ctx = await loadScenarioContext(game.scenarioId, game.scenarioVersion)
  const prep = 'targets' in input ? { targets: validatePrepTerms(ctx, input.targets), walkAway: validatePrepTerms(ctx, input.walkAway), plan: input.plan } : null
  const now = new Date()
  const db = await getDb()
  const r = await db.games.updateOne(
    { _id: game._id, userId: user.id, version: game.version, status: 'CREATED' },
    {
      $set: {
        status: 'ACTIVE',
        prep,
        startedAt: now,
        deadlineAt: game.timeLimitSec ? new Date(now.getTime() + game.timeLimitSec * 1000) : null,
        updatedAt: now,
      },
      $inc: { version: 1 },
    },
  )
  if (!r.matched) throw Errors.conflict('This game changed in another tab. Reload to continue.')
  return getGameView(user, gameId)
}

function decisionFrom(res: StepResult): Decision {
  const last = [...res.turns].reverse().find((t) => t.actor === 'counterpart')
  if (!last) return { kind: 'none' }
  if (last.action === 'COUNTERPART_ACCEPT' && last.offer) return { kind: 'accept', terms: last.offer }
  if (last.action === 'COUNTERPART_WALK') return { kind: 'walk' }
  if (last.action === 'COUNTER' && last.offer) return { kind: 'counter', terms: last.offer, final: Boolean(last.note?.startsWith('Final')) }
  return { kind: 'none' }
}

/**
 * AI mode: the engine decides, the character words it, signals adjust rapport for future turns.
 * Takes any negotiation (state + history), so Life Chess deals reuse it.
 */
export async function aiWordedStep(user: SessionUser, game: Pick<GameDoc, 'state' | 'turns'>, ctx: ScenarioContext, action: PlayerAction): Promise<{ res: StepResult; usage: { inputTokens: number; outputTokens: number } }> {
  const res = step(ctx, game.state, action, {}, { freeText: 'external' })
  const cpTurns = res.turns.filter((t) => t.actor === 'counterpart')
  if (!cpTurns.length) return { res, usage: { inputTokens: 0, outputTokens: 0 } }
  await enforce(RULES.aiTurn, user.id)
  await assertAiQuota(user.id, user.plan)
  const message = action.type === 'MESSAGE' ? action.text : action.type === 'MAKE_OFFER' ? (action.message ?? '') : ''
  const fallbackReply = cpTurns.map((t) => t.text).join(' ')
  let reply
  try {
    reply = await generateCharacterReply({
      pub: ctx.pub,
      priv: ctx.priv,
      state: res.state,
      history: game.turns,
      playerMessage: message || res.turns.find((t) => t.actor === 'player')?.text || '',
      playerOffer: action.type === 'MAKE_OFFER' ? res.state.playerOffer : null,
      decision: decisionFrom(res),
      fallbackReply,
    })
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      await recordUsage(user.id, 'AI_TURN', { provider: 'unknown', model: 'unknown', inputTokens: 0, outputTokens: 0 }, false)
      throw new AppError(503, 'AI_UNAVAILABLE', 'The AI character is unavailable right now. Try again in a moment, or continue this negotiation in Classic mode.')
    }
    throw err
  }
  await recordUsage(user.id, 'AI_TURN', reply.usage, !reply.fallback)
  const state: EngineState = structuredClone(res.state)
  if (!isTerminal(res.status)) {
    const { question: _q, ...sig } = reply.response.signals
    applySignalsTo(state, sig)
  }
  const keyTurn = [...cpTurns].reverse().find((t) => t.action !== 'REPLY') ?? cpTurns[cpTurns.length - 1]!
  const merged: Omit<Turn, 'idx' | 'at'> = {
    ...keyTurn,
    text: reply.response.reply,
    source: reply.fallback ? 'rules' : reply.usage.provider === 'mock' ? 'mock-ai' : 'ai',
    note: reply.fallback ? 'The AI reply could not be validated, so a rules-based reply was used.' : keyTurn.note,
  }
  const fk = reply.response.revealFactKey
  if (fk && !state.discovered.includes(fk)) {
    state.discovered.push(fk)
    const fact = ctx.priv.counterpart.facts.find((f) => f.key === fk)!
    merged.revealed = [...(merged.revealed ?? []), { key: fk, text: fact.label }]
  }
  const turns = [...res.turns.filter((t) => t.actor !== 'counterpart'), merged]
  return { res: { ...res, state, turns }, usage: { inputTokens: reply.usage.inputTokens, outputTokens: reply.usage.outputTokens } }
}

export async function submitAction(user: SessionUser, gameId: string, req: z.infer<typeof actionRequestSchema>): Promise<GameView> {
  const db = await getDb()
  const game = await ownedGame(user.id, gameId)
  if (game.processedKeys.includes(req.idempotencyKey)) return getGameView(user, gameId)
  if (req.expectedVersion !== undefined && req.expectedVersion !== game.version) throw Errors.conflict('This game changed in another tab. Reload to continue.')
  const ctx = await loadScenarioContext(game.scenarioId, game.scenarioVersion)
  const action = req.action
  const now = new Date()

  // Timed mode: the server clock is the only authority.
  if (game.status === 'ACTIVE' && game.deadlineAt && now > game.deadlineAt) {
    const expired = await persist(game, expire(game.state), req.idempotencyKey, now)
    if (expired) await completeGame(user, expired, ctx)
    return getGameView(user, gameId)
  }

  if (action.type === 'PAUSE' || action.type === 'RESUME') {
    const pausing = action.type === 'PAUSE'
    if (pausing && game.status !== 'ACTIVE') throw Errors.conflict('Only an active negotiation can be paused.')
    if (!pausing && game.status !== 'PAUSED') throw Errors.conflict('This negotiation is not paused.')
    const set: Partial<GameDoc> = pausing
      ? { status: 'PAUSED', pausedRemainingSec: game.deadlineAt ? Math.max(0, Math.round((game.deadlineAt.getTime() - now.getTime()) / 1000)) : null, deadlineAt: null }
      : { status: 'ACTIVE', deadlineAt: game.pausedRemainingSec !== null ? new Date(now.getTime() + game.pausedRemainingSec * 1000) : null, pausedRemainingSec: null }
    const r = await db.games.updateOne(
      { _id: game._id, userId: user.id, version: game.version },
      { $set: { ...set, updatedAt: now }, $inc: { version: 1 }, $push: { processedKeys: { $each: [req.idempotencyKey], $slice: -MAX_KEYS }, turns: { idx: game.turns.length, at: now.toISOString(), actor: 'system', action: action.type, text: pausing ? 'Negotiation paused.' : 'Negotiation resumed.' } } },
    )
    if (!r.matched) return retryOrConflict(user, gameId, req.idempotencyKey)
    return getGameView(user, gameId)
  }

  if (game.status === 'CREATED') throw Errors.conflict('Finish or skip preparation first.')
  if (game.status === 'PAUSED') throw Errors.conflict('Resume the negotiation first.')
  if (isTerminal(game.status)) throw Errors.conflict('This negotiation has already ended.')

  let res: StepResult
  let aiUsage = { inputTokens: 0, outputTokens: 0 }
  const usesAi = game.mode === 'AI' && (action.type === 'MESSAGE' || action.type === 'MAKE_OFFER' || action.type === 'REQUEST_CONCESSION' || action.type === 'REJECT')
  if (usesAi) {
    if (!(await aiAvailable())) throw new AppError(503, 'AI_UNAVAILABLE', 'AI negotiation is turned off right now. Continue this negotiation in Classic mode.')
    const out = await aiWordedStep(user, game, ctx, action)
    res = out.res
    aiUsage = out.usage
  } else {
    res = step(ctx, game.state, action)
  }

  const snapshotLabel = res.turns.find((t) => t.actor === 'player')?.text.slice(0, 80) ?? action.type
  const updated = await persist(game, res, req.idempotencyKey, now, { snapshot: { turnIdx: game.turns.length, label: snapshotLabel, state: game.state }, aiUsage })
  if (!updated) return retryOrConflict(user, gameId, req.idempotencyKey)
  if (isTerminal(updated.status)) await completeGame(user, updated, ctx)
  return getGameView(user, gameId)
}

async function retryOrConflict(user: SessionUser, gameId: string, key: string): Promise<GameView> {
  const g = await ownedGame(user.id, gameId)
  if (g.processedKeys.includes(key)) return getGameView(user, gameId)
  throw Errors.conflict('This game changed in another tab. Reload to continue.')
}

async function persist(
  game: GameDoc,
  res: StepResult,
  idemKey: string,
  now: Date,
  extra: { snapshot?: GameDoc['snapshots'][number]; aiUsage?: { inputTokens: number; outputTokens: number } } = {},
): Promise<GameDoc | null> {
  const db = await getDb()
  const newTurns: Turn[] = res.turns.map((t, i) => ({ ...t, idx: game.turns.length + i, at: now.toISOString() }))
  const terminal = isTerminal(res.status)
  const set: Record<string, unknown> = { state: res.state, status: res.status, updatedAt: now }
  if (terminal) {
    set.outcome = res.outcome
    set.completedAt = now
    set.deadlineAt = null
  }
  const inc: Record<string, number> = { version: 1 }
  if (extra.aiUsage && (extra.aiUsage.inputTokens || extra.aiUsage.outputTokens)) {
    inc['aiUsage.calls'] = 1
    inc['aiUsage.inputTokens'] = extra.aiUsage.inputTokens
    inc['aiUsage.outputTokens'] = extra.aiUsage.outputTokens
  }
  const push: Record<string, unknown> = {
    turns: { $each: newTurns },
    processedKeys: { $each: [idemKey], $slice: -MAX_KEYS },
  }
  if (extra.snapshot) push.snapshots = { $each: [extra.snapshot], $slice: -60 }
  const updated = await db.games.findOneAndUpdate(
    { _id: game._id, userId: game.userId, version: game.version },
    { $set: set, $inc: inc, $push: push } as never,
    { returnDocument: 'after' },
  )
  return updated
}

export async function switchToClassic(user: SessionUser, gameId: string) {
  const game = await ownedGame(user.id, gameId)
  if (game.mode === 'CLASSIC') return getGameView(user, gameId)
  if (isTerminal(game.status)) throw Errors.conflict('This negotiation has already ended.')
  const db = await getDb()
  const now = new Date()
  await db.games.updateOne(
    { _id: game._id, userId: user.id, version: game.version },
    { $set: { mode: 'CLASSIC' as GameMode, updatedAt: now }, $inc: { version: 1 }, $push: { turns: { idx: game.turns.length, at: now.toISOString(), actor: 'system', action: 'SYSTEM', text: 'Switched to Classic mode. Replies now follow the scenario rules.' } } },
  )
  return getGameView(user, gameId)
}

export async function saveNotes(user: SessionUser, gameId: string, notes: string) {
  const game = await ownedGame(user.id, gameId)
  await (await getDb()).games.updateOne({ _id: game._id, userId: user.id }, { $set: { notes: notes.slice(0, 2000) } })
  return { ok: true }
}

export async function createReplay(user: SessionUser, gameId: string, snapshotIndex: number): Promise<{ id: string }> {
  const game = await ownedGame(user.id, gameId)
  if (!isTerminal(game.status)) throw Errors.conflict('You can replay a negotiation once it has ended.')
  const snap = game.snapshots[snapshotIndex]
  if (!snap) throw Errors.invalid('Choose a moment from this negotiation to replay from.')
  const db = await getDb()
  const now = new Date()
  const mode: GameMode = game.mode === 'AI' && (await aiAvailable()) ? 'AI' : 'CLASSIC'
  const turns = game.turns.slice(0, snap.turnIdx).map((t) => ({ ...t }))
  turns.push({ idx: turns.length, at: now.toISOString(), actor: 'system', action: 'SYSTEM', text: 'Replay started from this point. Your original negotiation is unchanged.' })
  const replay: GameDoc = {
    ...game,
    _id: crypto.randomUUID(),
    mode,
    variant: 'REPLAY',
    status: 'ACTIVE',
    state: structuredClone(snap.state),
    turns,
    processedKeys: [],
    version: 0,
    timeLimitSec: null,
    startedAt: now,
    deadlineAt: null,
    outcome: null,
    score: null,
    challengeSlug: null,
    replayOf: { gameId: game._id, fromTurn: snap.turnIdx },
    aiUsage: { calls: 0, inputTokens: 0, outputTokens: 0 },
    snapshots: game.snapshots.slice(0, snapshotIndex).map((s) => ({ ...s })),
    pausedRemainingSec: null,
    progressApplied: false,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    notes: game.notes,
  }
  await db.games.insertOne(replay)
  return { id: replay._id }
}

export function buildView(game: GameDoc, ctx: ScenarioContext, opts: { showRapport: boolean; aiAvailable: boolean; challenge: GameView['challenge']; lesson: GameView['lesson'] }): GameView {
  const s = game.state
  const active = game.status === 'ACTIVE' || game.status === 'PAUSED'
  return {
    id: game._id,
    status: game.status,
    mode: game.mode,
    variant: game.variant,
    version: game.version,
    scenario: ctx.pub,
    turns: game.turns,
    phase: s.phase,
    turn: s.turn,
    maxTurns: ctx.pub.maxTurns,
    rapport: opts.showRapport ? rapportLabel(s.trust) : null,
    playerOffer: s.playerOffer,
    counterOffer: s.counterOffer,
    finalOfferIssued: s.finalOfferIssued,
    offerHistory: s.offers,
    discovered: s.discovered.map((k) => {
      if (k === 'priorities') {
        const top = Object.entries(ctx.priv.counterpart.weights).sort((a, b) => b[1] - a[1])[0]?.[0]
        return { key: k, text: `Their top priority is ${ctx.pub.issues.find((i) => i.key === top)?.label.toLowerCase() ?? 'unclear'}.` }
      }
      return { key: k, text: ctx.priv.counterpart.facts.find((f) => f.key === k)?.label ?? k }
    }),
    questions: active && game.mode === 'CLASSIC' ? availableQuestions(ctx, s) : [],
    statements: active && game.mode === 'CLASSIC' ? availableStatements(ctx, s) : [],
    timeLimitSec: game.timeLimitSec,
    deadlineAt: game.deadlineAt?.toISOString() ?? null,
    pausedRemainingSec: game.pausedRemainingSec,
    serverNow: new Date().toISOString(),
    prep: game.prep,
    notes: game.notes,
    aiAvailable: opts.aiAvailable,
    challenge: opts.challenge,
    lesson: opts.lesson,
    replayOf: game.replayOf,
    snapshots: game.snapshots.map((x) => ({ turnIdx: x.turnIdx, label: x.label })),
    outcome: game.outcome,
    createdAt: game.createdAt.toISOString(),
    completedAt: game.completedAt?.toISOString() ?? null,
  }
}

export async function getGameView(user: SessionUser, gameId: string): Promise<GameView> {
  let game = await ownedGame(user.id, gameId)
  const ctx = await loadScenarioContext(game.scenarioId, game.scenarioVersion)
  if (game.status === 'ACTIVE' && game.deadlineAt && new Date() > game.deadlineAt) {
    const expired = await persist(game, expire(game.state), `expire-${game.version}`, new Date())
    if (expired) {
      await completeGame(user, expired, ctx)
      game = expired
    } else {
      game = await ownedGame(user.id, gameId)
    }
  }
  const db = await getDb()
  const [prefs, ai, challenge, lesson] = await Promise.all([
    prefsFor(user.id),
    aiAvailable(),
    game.challengeSlug ? db.challenges.findOne({ slug: game.challengeSlug }) : null,
    game.lessonSlug ? db.lessons.findOne({ slug: game.lessonSlug }) : null,
  ])
  return buildView(game, ctx, {
    showRapport: prefs?.showRapport ?? true,
    aiAvailable: ai,
    challenge: challenge ? { slug: challenge.slug, title: challenge.title, criteriaText: challenge.criteriaText } : null,
    lesson: lesson ? { slug: lesson.slug, title: lesson.title } : null,
  })
}

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  status: z.enum(['all', 'completed', 'active']).default('all'),
  mode: z.enum(['CLASSIC', 'AI']).optional(),
})

export async function listHistory(userId: string, q: z.infer<typeof historyQuerySchema>): Promise<{ items: HistoryItem[]; total: number; pageSize: number }> {
  const db = await getDb()
  const pageSize = 15
  const filter: Record<string, unknown> = { userId }
  if (q.status === 'completed') filter.status = { $in: ['AGREEMENT_REACHED', 'WALKED_AWAY', 'FAILED', 'EXPIRED'] }
  if (q.status === 'active') filter.status = { $in: ['CREATED', 'ACTIVE', 'PAUSED'] }
  if (q.mode) filter.mode = q.mode
  const [docs, total] = await Promise.all([
    db.games.find(filter as never, {
      sort: { createdAt: -1 },
      skip: (q.page - 1) * pageSize,
      limit: pageSize,
      projection: { _id: 1, scenarioSlug: 1, scenarioTitle: 1, category: 1, difficulty: 1, mode: 1, variant: 1, status: 1, score: 1, createdAt: 1, completedAt: 1 },
    }),
    db.games.countDocuments(filter as never),
  ])
  return {
    items: docs.map((g) => ({
      id: g._id,
      scenarioSlug: g.scenarioSlug,
      scenarioTitle: g.scenarioTitle,
      category: g.category,
      difficulty: g.difficulty,
      mode: g.mode,
      variant: g.variant,
      status: g.status,
      score: g.score,
      createdAt: g.createdAt.toISOString(),
      completedAt: g.completedAt?.toISOString() ?? null,
    })),
    total,
    pageSize,
  }
}

export function describeOffer(ctx: ScenarioContext, terms: Terms | null) {
  return formatTerms(ctx.pub.issues, terms)
}
