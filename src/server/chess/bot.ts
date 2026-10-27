import type { BotLevel, Color, PieceType } from '@/lib/chess/types'
import { algebraic, BITS, FastBoard, type FastMove, type FastPiece } from './fast'

/**
 * Deterministic-by-seed chess bot: negamax with alpha-beta, capture-only
 * quiescence, MVV-LVA ordering and piece-square tables, under a time budget.
 * Levels change depth and how much it deliberately strays from the best move,
 * so Relaxed opponents feel human rather than random.
 */

export const VALUES: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }

// Piece-square tables from White's point of view, rank 8 first (Michniewski's simplified evaluation).
const PST: Record<PieceType | 'kEnd', number[]> = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  kEnd: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
}

const MATE = 100_000

/** Non-king material (centipawns) on the board, used to switch to endgame king tables. */
function phaseMaterial(board: FastPiece[]): number {
  let m = 0
  for (let i = 0; i < 128; i++) {
    if (i & 0x88) continue
    const p = board[i]
    if (p && p.type !== 'k' && p.type !== 'p') m += VALUES[p.type]
  }
  return m
}

/** Static evaluation from the side to move's point of view. */
export function evaluate(board: FastPiece[], turn: Color): number {
  const endgame = phaseMaterial(board) <= 2600
  let score = 0
  for (let i = 0; i < 128; i++) {
    if (i & 0x88) continue
    const p = board[i]
    if (!p) continue
    const row = i >> 4
    const col = i & 15
    const idx = (p.color === 'w' ? row : 7 - row) * 8 + col
    const table = p.type === 'k' && endgame ? PST.kEnd : PST[p.type]
    const v = VALUES[p.type] + table[idx]!
    score += p.color === 'w' ? v : -v
  }
  return turn === 'w' ? score : -score
}

/** Material balance in pawns from `color`'s point of view (for classifying moments). */
export function materialFor(board: FastPiece[], color: Color): number {
  let s = 0
  for (let i = 0; i < 128; i++) {
    if (i & 0x88) continue
    const p = board[i]
    if (p) s += (p.color === color ? 1 : -1) * VALUES[p.type]
  }
  return s / 100
}

function orderScore(m: FastMove): number {
  let s = 0
  if (m.captured) s += 10 * VALUES[m.captured] - VALUES[m.piece]
  if (m.promotion) s += VALUES[m.promotion]
  return s
}

/**
 * Root-only "bird in the hand" bonus for material won this move. Without it
 * the horizon makes a gain that is still available next move look equally
 * good, so the bot could postpone a promotion forever.
 */
const MAX_REALIZE = 110
function realizeBonus(m: FastMove): number {
  return ((m.captured ? VALUES[m.captured] : 0) + (m.promotion ? VALUES[m.promotion] - VALUES.p : 0)) / 12
}

class Timeout extends Error {}

type SearchCtx = { b: FastBoard; deadline: number; nodes: number; quiesce: boolean }

function quiescence(ctx: SearchCtx, alpha: number, beta: number, depth: number): number {
  const stand = evaluate(ctx.b.board, ctx.b.turn)
  if (!ctx.quiesce || depth <= 0) return stand
  if (stand >= beta) return beta
  if (stand > alpha) alpha = stand
  const caps = ctx.b
    .moves()
    .filter((m) => m.flags & (BITS.CAPTURE | BITS.EP_CAPTURE | BITS.PROMOTION))
    .sort((a, b) => orderScore(b) - orderScore(a))
  for (const m of caps) {
    ctx.b.make(m)
    const score = -quiescence(ctx, -beta, -alpha, depth - 1)
    ctx.b.undo()
    if (score >= beta) return beta
    if (score > alpha) alpha = score
  }
  return alpha
}

function negamax(ctx: SearchCtx, depth: number, alpha: number, beta: number, ply: number): number {
  if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) throw new Timeout()
  const moves = ctx.b.moves()
  if (!moves.length) return ctx.b.inCheck() ? -MATE + ply : 0
  if (depth === 0) return quiescence(ctx, alpha, beta, 4)
  moves.sort((a, b) => orderScore(b) - orderScore(a))
  for (const m of moves) {
    ctx.b.make(m)
    const score = -negamax(ctx, depth - 1, -beta, -alpha, ply + 1)
    ctx.b.undo()
    if (score >= beta) return beta
    if (score > alpha) alpha = score
  }
  return alpha
}

export type BotMove = { from: string; to: string; promotion?: PieceType }

const LEVELS: Record<BotLevel, { depth: number; quiesce: boolean; slack: number; budgetMs: number }> = {
  1: { depth: 1, quiesce: false, slack: 140, budgetMs: 300 },
  2: { depth: 2, quiesce: true, slack: 35, budgetMs: 700 },
  3: { depth: 4, quiesce: true, slack: 0, budgetMs: 900 },
}

/** Search score in pawns from the side to move's point of view, for deal decisions (draw offers, trades). */
export function scorePosition(fen: string, depth = 2): number {
  const b = new FastBoard(fen)
  const ctx: SearchCtx = { b, deadline: Date.now() + 600, nodes: 0, quiesce: true }
  try {
    return negamax(ctx, depth, -MATE - 1, MATE + 1, 0) / 100
  } catch (err) {
    if (!(err instanceof Timeout)) throw err
    // The interrupted search leaves moves made on `b`; score a fresh board instead.
    const fresh = new FastBoard(fen)
    return evaluate(fresh.board, fresh.turn) / 100
  }
}

/** mulberry32: small seeded PRNG so tests can make the bot reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Pick the bot's move. Root moves are scored by iterative deepening up to the
 * level's depth (the last fully completed depth wins on timeout); then a move
 * is chosen at random among those within the level's slack of the best.
 */
export function chooseMove(fen: string, level: BotLevel, rand: () => number = Math.random): BotMove | null {
  const cfg = LEVELS[level]
  const b = new FastBoard(fen)
  const root = b.moves()
  if (!root.length) return null
  const ctx: SearchCtx = { b, deadline: Date.now() + cfg.budgetMs, nodes: 0, quiesce: cfg.quiesce }
  let scored = root.map((m) => ({ m, score: orderScore(m) }))
  for (let depth = 1; depth <= cfg.depth; depth++) {
    const ordered = [...scored].sort((x, y) => y.score - x.score)
    const next: { m: FastMove; score: number }[] = []
    let bestSoFar = -MATE - 1
    try {
      for (const { m } of ordered) {
        // Moves that cannot reach the pick pool, even with the largest bonus, only need to prove they are worse (fail low).
        const alpha = bestSoFar <= -MATE ? -MATE - 1 : bestSoFar - cfg.slack - 1 - MAX_REALIZE
        b.make(m)
        try {
          const raw = -negamax(ctx, depth - 1, -MATE - 1, -alpha, 1)
          const score = Math.abs(raw) > MATE / 2 ? raw : raw + realizeBonus(m)
          next.push({ m, score })
          if (score > bestSoFar) bestSoFar = score
        } finally {
          b.undo()
        }
      }
      scored = next
    } catch (err) {
      if (!(err instanceof Timeout)) throw err
      break
    }
    if (bestSoFar > MATE / 2) break
  }
  const best = Math.max(...scored.map((s) => s.score))
  // Never stray from a forced mate or into one.
  const slack = Math.abs(best) > MATE / 2 ? 0 : cfg.slack
  const pool = scored.filter((s) => s.score >= best - slack)
  const pick = pool[Math.floor(rand() * pool.length)] ?? scored[0]!
  return { from: algebraic(pick.m.from), to: algebraic(pick.m.to), promotion: pick.m.promotion }
}
