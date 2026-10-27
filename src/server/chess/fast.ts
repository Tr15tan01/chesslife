import { Chess } from 'chess.js'
import type { Color, PieceType } from '@/lib/chess/types'

/**
 * Thin adapter over chess.js internals for the bot's search. The public
 * `move()` API recomputes SAN for every candidate (~5k nodes/s); the internal
 * generator is ~70x faster. chess.js is pinned to an exact version and
 * `tests/unit/chess.test.ts` runs perft through this adapter, so an upgrade
 * that changes these internals fails loudly instead of playing bad chess.
 */

export type FastMove = { color: Color; from: number; to: number; piece: PieceType; captured?: PieceType; promotion?: PieceType; flags: number }
export type FastPiece = { type: PieceType; color: Color } | undefined

type Internals = {
  _board: FastPiece[]
  _turn: Color
  _moves(opts: { legal: boolean }): FastMove[]
  _makeMove(m: FastMove): void
  _undoMove(): unknown
}

export const BITS = { NORMAL: 1, CAPTURE: 2, BIG_PAWN: 4, EP_CAPTURE: 8, PROMOTION: 16, KSIDE_CASTLE: 32, QSIDE_CASTLE: 64 } as const

export class FastBoard {
  private readonly c: Internals
  constructor(fen: string) {
    this.c = new Chess(fen) as unknown as Internals
  }
  get board(): FastPiece[] {
    return this.c._board
  }
  get turn(): Color {
    return this.c._turn
  }
  moves(): FastMove[] {
    return this.c._moves({ legal: true })
  }
  make(m: FastMove) {
    this.c._makeMove(m)
  }
  undo() {
    this.c._undoMove()
  }
  inCheck(): boolean {
    return (this.c as unknown as Chess).inCheck()
  }
}

/** 0x88 index → algebraic square (a8 = 0, h1 = 119). */
export function algebraic(i: number): string {
  return 'abcdefgh'[i & 15]! + String(8 - (i >> 4))
}
