import type { BoardEdit, ChessMoveView, Color, PieceType } from './types'

/**
 * Replays a move list into pieces with stable identities, so boards can
 * animate a piece from square to square (and off the board when captured)
 * instead of redrawing positions from a FEN.
 */

/** `last` is the most recent square, kept after capture so the exit can animate from there. */
export type TrackedPiece = { id: string; type: PieceType; color: Color; square: string | null; last: string; capturedAt: number | null }

const BACK: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
const FILES = 'abcdefgh'

export function initialPieces(): TrackedPiece[] {
  const out: TrackedPiece[] = []
  for (let f = 0; f < 8; f++) {
    const file = FILES[f]!
    out.push({ id: `w${file}1`, type: BACK[f]!, color: 'w', square: `${file}1`, last: `${file}1`, capturedAt: null })
    out.push({ id: `w${file}2`, type: 'p', color: 'w', square: `${file}2`, last: `${file}2`, capturedAt: null })
    out.push({ id: `b${file}7`, type: 'p', color: 'b', square: `${file}7`, last: `${file}7`, capturedAt: null })
    out.push({ id: `b${file}8`, type: BACK[f]!, color: 'b', square: `${file}8`, last: `${file}8`, capturedAt: null })
  }
  return out
}

/**
 * Taken-back moves are skipped, and negotiated edits remove pieces at their
 * point in the timeline; captured and removed pieces keep `last` for the exit.
 */
export function trackPieces(moves: ChessMoveView[], edits: BoardEdit[] = []): TrackedPiece[] {
  const pieces = initialPieces()
  const at = new Map(pieces.map((p) => [p.square!, p]))
  const applyEdits = (i: number) => {
    for (const e of edits) {
      if (e.afterMove !== i) continue
      for (const sq of e.remove) {
        const victim = at.get(sq)
        if (!victim) continue
        victim.square = null
        victim.capturedAt = i
        at.delete(sq)
      }
    }
  }
  for (const [i, m] of moves.entries()) {
    applyEdits(i)
    if (m.undone) continue
    const mover = at.get(m.from)
    if (!mover) continue
    const capSquare = m.flags.includes('e') ? `${m.to[0]}${m.from[1]}` : m.to
    const victim = m.captured ? at.get(capSquare) : undefined
    if (victim) {
      victim.square = null
      victim.capturedAt = m.ply
      at.delete(capSquare)
    }
    at.delete(m.from)
    mover.square = m.to
    mover.last = m.to
    if (m.promotion) mover.type = m.promotion
    at.set(m.to, mover)
    if (m.flags.includes('k') || m.flags.includes('q')) {
      const rank = m.from[1]
      const [rf, rt] = m.flags.includes('k') ? [`h${rank}`, `f${rank}`] : [`a${rank}`, `d${rank}`]
      const rook = at.get(rf)
      if (rook) {
        at.delete(rf)
        rook.square = rt
        rook.last = rt
        at.set(rt, rook)
      }
    }
  }
  applyEdits(moves.length)
  return pieces
}

export function squareXY(square: string): { file: number; rank: number } {
  return { file: square.charCodeAt(0) - 97, rank: Number(square[1]) - 1 }
}

export const STARTING_COUNT: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }
