import { Chess, type Square } from 'chess.js'
import type { BotLevel, Color, DealKind, DealOutcome, OpponentPublic } from '@/lib/chess/types'
import type { CounterpartStyle, Terms } from '@/lib/negotiation/types'
import { defineScenario } from '../content/kit'
import type { ScenarioContext } from '../engine/utility'

/**
 * Deals at the board. A takeback or a queen trade is a small negotiation
 * scenario generated from the live position (what can legally come off the
 * board, who is ahead) and played by the shared negotiation engine. Draw
 * offers are a yes/no decision from the bot's own evaluation.
 */

export type NegotiatedKind = Exclude<DealKind, 'DRAW'>

export type DealSpec = {
  kind: NegotiatedKind
  opponentKey: string
  by: 'player' | 'opponent'
  max: number
  target: number
  limit: number
  opening: number
  firmness: number
  floor: number
  trust: number
  patience: number
  /** Removed whenever the deal is agreed (the two queens in a trade). */
  fixed: string[]
  /** Removed one per agreed unit, in order. */
  removable: string[]
  playerBehind: boolean
}

const STYLE: Record<string, CounterpartStyle> = { sam: 'cooperative', dana: 'skeptical', victor: 'strategic' }
const PAWNS = ['no pawns', '1 pawn', '2 pawns', '3 pawns']
const FILE_ORDER = 'ahbgcfde'

// ── Legality ────────────────────────────────────────────────────────────────

/** Removing pieces must not leave the side that just moved in check. */
export function legalAfterRemoval(fen: string, squares: string[]): boolean {
  const c = new Chess(fen)
  for (const sq of squares) c.remove(sq as Square)
  const mover = c.turn()
  const other: Color = mover === 'w' ? 'b' : 'w'
  let kings = 0
  let otherKing: string | null = null
  for (const row of c.board())
    for (const p of row) {
      if (p?.type !== 'k') continue
      kings++
      if (p.color === other) otherKing = p.square
    }
  return kings === 2 && otherKing !== null && !c.isAttacked(otherKing as Square, mover)
}

/** Pawns of `color` that can come off together with `fixed`, least valuable first (rook pawns, least advanced). */
export function removablePawns(fen: string, color: Color, fixed: string[], max: number): string[] {
  const c = new Chess(fen)
  const pawns: string[] = []
  for (const row of c.board()) for (const p of row) if (p?.type === 'p' && p.color === color) pawns.push(p.square)
  const advance = (sq: string) => (color === 'w' ? Number(sq[1]) : 9 - Number(sq[1]))
  pawns.sort((a, b) => FILE_ORDER.indexOf(a[0]!) - FILE_ORDER.indexOf(b[0]!) || advance(a) - advance(b))
  const chosen: string[] = []
  for (const sq of pawns) {
    if (chosen.length >= max) break
    if (legalAfterRemoval(fen, [...fixed, ...chosen, sq])) chosen.push(sq)
  }
  return chosen
}

// ── Planning ────────────────────────────────────────────────────────────────

const TAKEBACK_PRICE: Record<BotLevel, { target: number; limit: (swing: number) => number; firmness: number; floor: number; trust: number; patience: number }> = {
  1: { target: 1, limit: () => 0, firmness: 0.8, floor: 0.1, trust: 60, patience: 4 },
  2: { target: 2, limit: (s) => (s >= 5 ? 1 : 0), firmness: 1.4, floor: 0.25, trust: 48, patience: 5 },
  3: { target: 3, limit: (s) => (s >= 5 ? 2 : 1), firmness: 2.2, floor: 0.35, trust: 38, patience: 5 },
}

/** `fen` is the position after the takeback (player to move); `swing` is what the mistake cost, in pawns. */
export function planTakeback(fen: string, playerColor: Color, op: OpponentPublic, swing: number, by: 'player' | 'opponent'): DealSpec | null {
  const removable = removablePawns(fen, playerColor, [], 3)
  if (!removable.length) return null
  const p = TAKEBACK_PRICE[op.level]
  const max = removable.length
  const target = Math.min(p.target, max)
  const limit = Math.min(p.limit(swing), target)
  return { kind: 'TAKEBACK', opponentKey: op.key, by, max, target, limit, opening: target, firmness: p.firmness, floor: p.floor, trust: p.trust, patience: p.patience, fixed: [], removable, playerBehind: false }
}

/** Both queens off the board; the opponent may add pawns to get it done. `botLead` is in pawns. */
export function planQueenTrade(fen: string, playerColor: Color, op: OpponentPublic, botLead: number): DealSpec | null {
  const c = new Chess(fen)
  const queens: Record<Color, string[]> = { w: [], b: [] }
  for (const row of c.board()) for (const p of row) if (p?.type === 'q') queens[p.color].push(p.square)
  const botColor: Color = playerColor === 'w' ? 'b' : 'w'
  if (queens.w.length !== 1 || queens.b.length !== 1) return null
  const fixed = [queens[playerColor][0]!, queens[botColor][0]!]
  if (!legalAfterRemoval(fen, fixed)) return null
  const removable = removablePawns(fen, botColor, fixed, 2)
  const firmness = { 1: 0.8, 2: 1.4, 3: 2.0 }[op.level]
  const floor = { 1: 0.1, 2: 0.3, 3: 0.35 }[op.level]
  const trust = { 1: 60, 2: 48, 3: 40 }[op.level]
  return { kind: 'QUEEN_TRADE', opponentKey: op.key, by: 'opponent', max: removable.length, target: 0, limit: Math.min(1, removable.length), opening: 0, firmness, floor, trust, patience: 4, fixed, removable, playerBehind: botLead > 0.5 }
}

/** When the opponent proposes a queen trade: ahead and wanting to simplify (or Sam, when level and in the mood). */
export function wantsQueenTrade(op: OpponentPublic, botLead: number, playerMoveNumber: number): boolean {
  if (playerMoveNumber < 6) return false
  if (op.level === 1) return Math.abs(botLead) <= 1 && playerMoveNumber >= 8 && playerMoveNumber <= 20
  return botLead >= 2
}

/** Draw offers: the opponent accepts unless it thinks it is winning by more than its threshold (pawns). */
export function drawAccepted(level: BotLevel, botScore: number): boolean {
  return botScore <= { 1: 2, 2: 0.3, 3: -1 }[level]
}

/** Squares removed when a negotiated deal is agreed on `terms`. */
export function removalFor(spec: DealSpec, terms: Terms): string[] {
  return [...spec.fixed, ...spec.removable.slice(0, terms.pawns ?? 0)]
}

// ── Scenario content ────────────────────────────────────────────────────────

type Persona = { factKey: string; factLabel: string; factText: string; factTrust: number; flex: number; deflection: string; precedent: string }

const TAKEBACK_PERSONA: Record<string, Persona> = {
  sam: {
    factKey: 'fun',
    factLabel: 'Sam cares more about a fun game than about winning',
    factText: 'Honestly? I just want a good game. Winning on a slip is boring.',
    factTrust: 40,
    flex: 0.25,
    deflection: 'Eh, just feeling generous.',
    precedent: "Ha, I'd be begging. Fair point.",
  },
  dana: {
    factKey: 'growth',
    factLabel: 'Dana respects players who own their mistakes',
    factText: "I'd rather play someone who learns from a mistake than someone who hides it.",
    factTrust: 52,
    flex: 0.2,
    deflection: 'Let us just say I have my reasons.',
    precedent: 'I would want it, and I would expect to pay for it.',
  },
  victor: {
    factKey: 'clock',
    factLabel: 'Victor has another meeting and wants a clean, quick game',
    factText: 'I have a call in twenty minutes. A long, messy game helps neither of us.',
    factTrust: 45,
    flex: 0.15,
    deflection: 'Because I can afford to.',
    precedent: 'I do not make mistakes I would need to buy back.',
  },
}

const TRADE_PERSONA: Record<string, Persona> = {
  sam: {
    factKey: 'quick',
    factLabel: 'Sam wants a quicker, simpler game before dinner',
    factText: 'Dinner is in half an hour and queens make everything complicated.',
    factTrust: 40,
    flex: 0.25,
    deflection: 'Just fancy a change of pace.',
    precedent: 'Sure, I would.',
  },
  dana: {
    factKey: 'convert',
    factLabel: 'Dana knows simplifying helps the side that is ahead',
    factText: 'Fewer pieces means fewer chances for you to come back. That is the honest answer.',
    factTrust: 52,
    flex: 0.12,
    deflection: 'It is a clean position either way.',
    precedent: 'Only if it suited me.',
  },
  victor: {
    factKey: 'convert',
    factLabel: 'Victor wants to convert his advantage with less risk',
    factText: 'I am ahead. Simple positions are easy to win. You know that, and so do I.',
    factTrust: 45,
    flex: 0.15,
    deflection: 'It is a fair, symmetrical trade.',
    precedent: 'If I were behind? Never.',
  },
}

const OPENING: Record<NegotiatedKind, Record<'player' | 'opponent', Record<string, string>>> = {
  TAKEBACK: {
    player: {
      sam: 'Sure, I am easy. Give me {offer} and the move is yours again.',
      dana: 'A takeback? It will cost you. {offer}.',
      victor: 'Everything has a price. {offer} and you can have the move back.',
    },
    opponent: {
      sam: 'Oof, that one hurt. Want to take it back? {offer} and we call it even.',
      dana: 'That was a slip. I will allow a takeback, but it should cost you: {offer}.',
      victor: 'I could let you take that back. For {offer}.',
    },
  },
  QUEEN_TRADE: {
    player: { sam: '', dana: '', victor: '' },
    opponent: {
      sam: 'How about we both take our queens off? Simpler game, more fun. Straight swap.',
      dana: 'I propose we trade queens. A straight swap, nothing added.',
      victor: 'Let us simplify. Queens off the board, a straight swap.',
    },
  },
}

export function dealTitle(kind: DealKind): string {
  return kind === 'TAKEBACK' ? 'Takeback deal' : kind === 'QUEEN_TRADE' ? 'Queen trade' : 'Draw offer'
}

export function dealDescription(spec: DealSpec, op: OpponentPublic): string {
  if (spec.kind === 'TAKEBACK') {
    return spec.by === 'player'
      ? `You asked to take back your last move. ${op.name} wants something in return: pawns (your habits) from your side of the board.`
      : `${op.name} offers to let you take back your last move, for a price paid in pawns (your habits).`
  }
  return `${op.name} proposes taking both queens off the board: your career for theirs. You can ask for pawns on top, or say no and keep playing.`
}

export function openingLine(spec: DealSpec, offerText: string): string {
  return OPENING[spec.kind][spec.by][spec.opponentKey]!.replace('{offer}', offerText)
}

/** Build the negotiation scenario for a deal. Deterministic from the spec, so it can be rebuilt every turn. */
export function buildDealContext(spec: DealSpec, op: OpponentPublic): ScenarioContext {
  const takeback = spec.kind === 'TAKEBACK'
  const persona = (takeback ? TAKEBACK_PERSONA : TRADE_PERSONA)[spec.opponentKey]!
  const choices = takeback ? PAWNS.slice(0, spec.max + 1) : ['no extra pawns', '1 pawn', '2 pawns'].slice(0, spec.max + 1)
  const built = defineScenario({
    slug: `chess-${spec.kind.toLowerCase()}`,
    title: dealTitle(spec.kind),
    summary: dealDescription(spec, op),
    description: dealDescription(spec, op),
    category: 'personal',
    difficulty: op.level,
    role: 'Chess player',
    cp: { name: op.name, role: op.role, style: STYLE[spec.opponentKey] ?? 'cooperative', bio: op.bio, tone: op.tone },
    issues: [
      {
        key: 'pawns',
        label: takeback ? 'Your price' : 'Pawns they add',
        unit: 'choice',
        min: 0,
        max: spec.max,
        step: 1,
        prefers: takeback ? 'lower' : 'higher',
        choices,
      },
    ],
    player: {
      limits: { pawns: takeback ? spec.max : 0 },
      targets: { pawns: takeback ? 0 : spec.max },
      batna: takeback ? 'Play on and live with the mistake.' : 'Keep the queens on and keep playing.',
      context: [],
    },
    objectives: [takeback ? 'Undo the mistake for as few pawns as possible, or decide it is not worth it.' : 'Decide whether simplifying helps you, and what it is worth.'],
    learning: takeback ? 'Fixing mistakes has a price. Know what it is worth to you.' : 'Trades help the side that is ahead.',
    success: takeback ? 'A takeback for one pawn or less.' : 'Declining when behind, or extra pawns when you agree.',
    range: choices.join(' to '),
    minutes: 2,
    maxTurns: 10,
    tags: ['chess'],
    opening: '',
    hidden: {
      target: { pawns: spec.target },
      limit: { pawns: spec.limit },
      opening: { pawns: spec.opening },
      firmness: spec.firmness,
      floor: spec.floor,
      trust: spec.trust,
      patience: spec.patience,
      agenda: takeback ? 'Get something real in return for a second chance.' : 'Simplify the position without giving much away.',
      notes: persona.factText,
    },
    facts: [{ key: persona.factKey, label: persona.factLabel, text: persona.factText, trust: persona.factTrust, flex: persona.flex, issue: 'pawns' }],
    questions: takeback
      ? [
          { key: 'why', prompt: 'Why let me take it back at all?', kind: 'interest', reveals: persona.factKey, answer: persona.factText, deflection: persona.deflection, kw: ['why', 'reason'] },
          { key: 'precedent', prompt: 'Would you want the same if you slipped?', kind: 'rapport', trust: 4, answer: persona.precedent, kw: ['same', 'slipped', 'you'] },
        ]
      : [
          { key: 'why', prompt: 'Why do you want to trade queens?', kind: 'interest', reveals: persona.factKey, answer: persona.factText, deflection: persona.deflection, kw: ['why', 'reason', 'trade'] },
          { key: 'precedent', prompt: 'Would you take this trade from my side?', kind: 'leading', trust: 2, answer: persona.precedent, kw: ['your side', 'would you', 'my side'] },
        ],
    statements: takeback
      ? [
          { key: 'own-it', text: 'That was my mistake, and I know a takeback is a favour.', kind: 'empathy', reply: 'Appreciated. Owning it helps.', kw: ['my mistake', 'favour', 'favor'] },
          { key: 'better-game', text: 'A game decided by one slip teaches neither of us much.', kind: 'rationale', flex: 0.06, reply: 'There is something to that.', kw: ['one slip', 'teaches', 'better game'] },
          { key: 'once', text: 'If you agree, I will not ask for another one this game.', kind: 'commitment', flex: 0.06, reply: 'Once. I will hold you to that.', kw: ['not ask', 'another', 'once'] },
          { key: 'bluff', text: 'I would resign anyway if you said no.', kind: 'bluff', reply: 'Then resign. I am not buying that.', kw: ['resign', 'anyway'] },
        ]
      : [
          { key: 'see-through', text: 'A trade helps whoever is ahead. I need a reason to simplify.', kind: 'rationale', flex: 0.06, reply: 'Fair. You have done your homework.', kw: ['ahead', 'reason', 'simplify'] },
          { key: 'fair', text: 'I get it, you want a cleaner game.', kind: 'empathy', reply: 'Exactly. Cleaner for both of us.', kw: ['cleaner', 'get it'] },
          { key: 'bluff', text: 'I would win the endgame anyway.', kind: 'bluff', reply: 'Then you should be happy to trade.', kw: ['endgame', 'win', 'anyway'] },
        ],
    rubric: { coaching: takeback ? 'Ask why they are offering before you pay.' : 'Ask what the trade does for them before you say yes.' },
  })
  return { pub: built.pub, priv: built.priv }
}

export function dealLesson(kind: DealKind, outcome: DealOutcome, spec: DealSpec | null, terms: Terms | null): string {
  const n = terms?.pawns ?? 0
  if (kind === 'TAKEBACK') {
    if (outcome === 'AGREED')
      return n === 0
        ? 'A free second chance. Most mistakes cost something to undo, so the real win is the habit of checking before you commit.'
        : `You paid ${PAWNS[n]} to undo a mistake. Fixing errors early is usually cheaper than living with them, but checking before you commit is cheaper still.`
    if (outcome === 'DECLINED') return 'You chose to live with the mistake and keep your pawns. Sometimes accepting a loss and playing on is the stronger choice.'
    return 'No agreement. When the other side holds the leverage, a second chance has to be worth their while.'
  }
  if (kind === 'QUEEN_TRADE') {
    if (outcome === 'AGREED')
      return spec?.playerBehind
        ? 'Trading when you are behind usually helps the side that is ahead: simpler positions are easier to convert. Ask what a trade does for them before you say yes.'
        : 'Simplifying when you are level or ahead reduces risk. A fair trade is one where you know exactly what you are giving up.'
    return spec?.playerBehind ? 'You kept your career in play. Complexity is the friend of the side that is behind.' : 'You kept the queens on. A trade you do not need is not a deal, it is a gift.'
  }
  return outcome === 'AGREED'
    ? 'A draw by agreement: both sides protected what mattered most.'
    : 'Your opponent believes they still have more to gain. An offer only lands when the other side’s alternative is worse.'
}
