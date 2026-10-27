import { LIFE_AREAS, PIECE_NAMES, type ChessStatus, type MomentKind, type OpponentPublic, type PieceType } from '@/lib/chess/types'
import { scenesForKind, type SceneDef } from './scenes'

/**
 * Turns a player move (plus the bot's reply) into life moments, then decides
 * which single moment, if any, earns a scene. Pure: the service supplies the
 * facts and persists the result.
 */

export type HalfMove = { piece: PieceType; captured?: PieceType; promotion?: PieceType; flags: string; check: boolean; san: string }

export type TurnFacts = {
  player: HalfMove
  bot: HalfMove | null
  /** Material from the player's side, in pawns. */
  materialBefore: number
  materialAfter: number
  playerMoveNumber: number
  enteredEndgame: boolean
  status: ChessStatus
}

const MAJOR: PieceType[] = ['q', 'r']
const PRIORITY: Record<MomentKind, 'final' | 'high' | 'medium' | 'low'> = {
  WIN: 'final',
  LOSE: 'final',
  DRAW: 'final',
  OPENING: 'high',
  PROMOTION: 'high',
  BLUNDER: 'high',
  BIG_LOSS: 'high',
  BIG_CAPTURE: 'high',
  CHECK_RECEIVED: 'high',
  TRADE: 'medium',
  CHECK_GIVEN: 'medium',
  CASTLE: 'medium',
  ENDGAME: 'medium',
  CAPTURE: 'low',
  LOSS: 'low',
  DEVELOPMENT: 'low',
}

/** Moments for this turn, most significant first. */
export function classifyTurn(f: TurnFacts): MomentKind[] {
  const out: MomentKind[] = []
  if (f.status === 'WON') out.push('WIN')
  if (f.status === 'LOST') out.push('LOSE')
  if (f.status === 'DRAWN') out.push('DRAW')
  const { player: p, bot: b } = f
  const net = f.materialAfter - f.materialBefore
  if (p.promotion) out.push('PROMOTION')
  if (b?.captured && net <= -3) out.push('BLUNDER')
  if (b?.captured && MAJOR.includes(b.captured) && net < -1) out.push('BIG_LOSS')
  if (p.captured && MAJOR.includes(p.captured) && net > 1) out.push('BIG_CAPTURE')
  if (b?.check) out.push('CHECK_RECEIVED')
  if (f.playerMoveNumber === 1) out.push('OPENING')
  if (p.captured && b?.captured && Math.abs(net) <= 1) out.push('TRADE')
  if (p.check) out.push('CHECK_GIVEN')
  if (p.flags.includes('k') || p.flags.includes('q')) out.push('CASTLE')
  if (f.enteredEndgame) out.push('ENDGAME')
  if (p.captured && net > 0) out.push('CAPTURE')
  if (b?.captured && net < 0) out.push('LOSS')
  if ((p.piece === 'n' || p.piece === 'b') && f.playerMoveNumber <= 8 && !p.captured) out.push('DEVELOPMENT')
  return out
}

export type SceneHistory = { kind: MomentKind; sceneKey: string; playerMoveNumber: number }[]

/**
 * One scene per turn at most. Endings always get one; high-priority moments
 * appear up to twice each; medium needs a two-move gap since the last scene,
 * low a four-move gap. Variants are not repeated within a game.
 */
export function pickScene(kinds: MomentKind[], history: SceneHistory, playerMoveNumber: number, seed: number): SceneDef | null {
  const last = history.at(-1)?.playerMoveNumber ?? -Infinity
  const gap = playerMoveNumber - last
  for (const kind of kinds) {
    const tier = PRIORITY[kind]
    const shown = history.filter((h) => h.kind === kind).length
    if (tier === 'high' && shown >= 2) continue
    if (tier === 'medium' && gap < 2) continue
    if (tier === 'low' && gap < 4) continue
    const used = new Set(history.map((h) => h.sceneKey))
    const variants = scenesForKind(kind)
    const fresh = variants.filter((v) => !used.has(v.key))
    const pool = fresh.length ? fresh : tier === 'final' ? variants : []
    if (!pool.length) continue
    return pool[seed % pool.length]!
  }
  return null
}

/** Stable small hash so scene variants differ between games but not between retries. */
export function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

// ── Classic-mode commentary ─────────────────────────────────────────────────

const area = (t: PieceType) => LIFE_AREAS[t].area.toLowerCase()

/** What the opponent says about the turn, in Classic mode. */
export function classicComment(op: OpponentPublic, kinds: MomentKind[], f: TurnFacts, seed: number): string {
  const pick = (lines: string[]) => lines[seed % lines.length]!
  const p = f.player
  const b = f.bot
  const k = kinds[0]
  const voice: Record<string, string[]> = {
    sam: ['Ha, okay, okay.', 'Oh, I see what you are doing.', 'Not bad, flatmate.'],
    dana: ['Interesting choice.', 'Noted.', 'Let us see if that holds up.'],
    victor: ['Hm.', 'A considered move.', 'Every move has a price.'],
  }
  const opener = pick(voice[op.key] ?? ['Your move.'])
  switch (k) {
    case 'WIN':
      return pick(['Well played. You earned that one.', 'Checkmate. I did not see it coming until it was too late.'])
    case 'LOSE':
      return pick(['Checkmate. Good game, and a lesson for both of us.', 'That is mate. Shall we look at where it turned?'])
    case 'DRAW':
      return pick(['A draw. Neither of us gave anything away.', 'Fair split. We both protected what mattered.'])
    case 'PROMOTION':
      return `${opener} A pawn that walked all the way. Habits like that become your ${area(p.promotion ?? 'q')}.`
    case 'BLUNDER':
      return `I will take that ${PIECE_NAMES[b!.captured!]}, thank you. Moving fast cost you some of your ${area(b!.captured!)}.`
    case 'BIG_LOSS':
      return `${b!.san}. Losing your ${PIECE_NAMES[b!.captured!]} hurts: that is a hit to your ${area(b!.captured!)}. What is your plan now?`
    case 'BIG_CAPTURE':
      return `${opener} You took my ${PIECE_NAMES[p.captured!]}. That is a serious gain in ${area(p.captured!)}, so do not get careless now.`
    case 'CHECK_RECEIVED':
      return `${b!.san}, check. Pressure is on. How do you respond?`
    case 'TRADE':
      return `A fair trade: ${PIECE_NAMES[p.captured!]} for ${PIECE_NAMES[b!.captured!]}. Equal on paper; we will see who uses it better.`
    case 'CHECK_GIVEN':
      return `${opener} Check. I will step aside, but pressure without a plan just moves my king.`
    case 'CASTLE':
      return `${opener} Castling. Safety first: a sensible way to protect yourself before you take risks.`
    case 'ENDGAME':
      return 'Fewer pieces now. Every decision from here weighs more.'
    case 'CAPTURE':
      return `${opener} You picked up a ${PIECE_NAMES[p.captured!]}. Small wins add up.`
    case 'LOSS':
      return `${b!.san}. I took a ${PIECE_NAMES[b!.captured!]}. Small setback, not the end.`
    case 'OPENING':
      return pick([`${opener} Let us see how you open.`, 'A new game, a fresh start. Show me your plan.'])
    case 'DEVELOPMENT':
      return `${opener} Getting your ${area(p.piece)} into play early. Sensible.`
    default:
      return b ? `${opener} I will answer with ${b.san}.` : opener
  }
}
