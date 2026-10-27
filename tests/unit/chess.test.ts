import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { FastBoard } from '@/server/chess/fast'
import { chooseMove, seededRandom } from '@/server/chess/bot'
import { classifyTurn, hashSeed, pickScene, type TurnFacts } from '@/server/chess/moments'
import { SCENES, scenesForKind } from '@/server/chess/scenes'
import { trackPieces } from '@/lib/chess/pieces'
import { MOMENT_KINDS, type ChessMoveView } from '@/lib/chess/types'

function perft(b: FastBoard, depth: number): number {
  if (depth === 0) return 1
  let n = 0
  for (const m of b.moves()) {
    b.make(m)
    n += perft(b, depth - 1)
    b.undo()
  }
  return n
}

describe('chess.js internals adapter', () => {
  it('matches known perft counts (guards the pinned chess.js internals)', () => {
    expect(perft(new FastBoard(new Chess().fen()), 3)).toBe(8902)
    // "Kiwipete": castling, en passant, promotions and pins.
    expect(perft(new FastBoard('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'), 2)).toBe(2039)
  })
})

describe('bot', () => {
  it('finds mate in one at every level', () => {
    for (const level of [1, 2, 3] as const) expect(chooseMove('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', level, seededRandom(1))).toEqual({ from: 'a1', to: 'a8' })
  })

  it('takes a hanging queen at competitive levels', () => {
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/3qP3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 1'
    for (const level of [2, 3] as const) expect(chooseMove(fen, level, seededRandom(2))).toEqual({ from: 'f3', to: 'd4' })
  })

  it('always returns a legal move and promotes when it should', () => {
    const m = chooseMove('8/P6k/8/8/8/8/8/K7 w - - 0 1', 2, seededRandom(3))!
    expect(m).toMatchObject({ from: 'a7', to: 'a8', promotion: 'q' })
    expect(() => new Chess('8/P6k/8/8/8/8/8/K7 w - - 0 1').move(m)).not.toThrow()
  })

  it('returns null when there are no legal moves', () => {
    expect(chooseMove('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 1)).toBeNull()
  })
})

function views(sans: string[]): ChessMoveView[] {
  const c = new Chess()
  return sans.map((san, ply) => {
    const m = c.move(san)
    return { ply, color: m.color, san: m.san, from: m.from, to: m.to, piece: m.piece, captured: m.captured, promotion: m.promotion, flags: m.flags, check: /[+#]$/.test(m.san) }
  })
}

describe('piece tracker', () => {
  it('keeps identities through castling and captures', () => {
    const p = trackPieces(views(['e4', 'd5', 'exd5', 'Qxd5', 'Nf3', 'Nf6', 'Be2', 'e6', 'O-O']))
    expect(p.find((x) => x.id === 'we1')!.square).toBe('g1')
    expect(p.find((x) => x.id === 'wh1')!.square).toBe('f1')
    const pawn = p.find((x) => x.id === 'we2')!
    expect(pawn.square).toBeNull()
    expect(pawn.last).toBe('d5')
    expect(pawn.capturedAt).toBe(3)
  })

  it('handles en passant and promotion', () => {
    const ep = trackPieces(views(['e4', 'a6', 'e5', 'd5', 'exd6']))
    expect(ep.find((x) => x.id === 'bd7')!.square).toBeNull()
    expect(ep.find((x) => x.id === 'we2')!.square).toBe('d6')
    const promo = trackPieces(views(['h4', 'g5', 'hxg5', 'Nf6', 'g6', 'Ne4', 'g7', 'Nd6', 'gxh8=Q']))
    const q = promo.find((x) => x.id === 'wh2')!
    expect(q).toMatchObject({ type: 'q', square: 'h8' })
  })
})

const quiet = { piece: 'p' as const, flags: 'n', check: false, san: 'e4' }
const facts = (over: Partial<TurnFacts>): TurnFacts => ({ player: quiet, bot: { ...quiet, san: 'e5' }, materialBefore: 0, materialAfter: 0, playerMoveNumber: 5, enteredEndgame: false, status: 'ACTIVE', ...over })

describe('moments', () => {
  it('classifies the significant moments of a turn, most important first', () => {
    expect(classifyTurn(facts({ playerMoveNumber: 1 }))).toEqual(['OPENING'])
    expect(classifyTurn(facts({ bot: { piece: 'n', captured: 'q', flags: 'c', check: false, san: 'Nxd1' }, materialAfter: -9 }))).toEqual(['BLUNDER', 'BIG_LOSS', 'LOSS'])
    expect(classifyTurn(facts({ player: { piece: 'b', captured: 'n', flags: 'c', check: false, san: 'Bxc6' }, bot: { piece: 'p', captured: 'b', flags: 'c', check: false, san: 'dxc6' } }))).toEqual(['TRADE'])
    expect(classifyTurn(facts({ player: { piece: 'k', flags: 'k', check: false, san: 'O-O' } }))).toEqual(['CASTLE'])
    expect(classifyTurn(facts({ status: 'WON', bot: null, player: { piece: 'q', flags: 'n', check: true, san: 'Qh7#' } }))[0]).toBe('WIN')
  })

  it('throttles scenes and never repeats a variant', () => {
    const first = pickScene(['OPENING'], [], 1, 0)!
    expect(first.kind).toBe('OPENING')
    const history = [{ kind: first.kind, sceneKey: first.key, playerMoveNumber: 1 }]
    // A low-priority moment one move later is skipped.
    expect(pickScene(['CAPTURE'], history, 2, 0)).toBeNull()
    expect(pickScene(['CAPTURE'], history, 5, 0)?.kind).toBe('CAPTURE')
    // Medium needs a two-move gap.
    expect(pickScene(['CASTLE'], history, 2, 0)).toBeNull()
    expect(pickScene(['CASTLE'], history, 3, 0)?.kind).toBe('CASTLE')
    // High priority appears immediately, but a variant is not reused.
    const second = pickScene(['OPENING'], history, 2, 0)!
    expect(second.key).not.toBe(first.key)
    // Endings always get a scene.
    expect(pickScene(['WIN'], [{ kind: 'CAPTURE', sceneKey: 'refund', playerMoveNumber: 9 }], 9, hashSeed('x'))?.kind).toBe('WIN')
  })
})

describe('scene library', () => {
  it('covers every moment kind with well-formed scenes', () => {
    for (const kind of MOMENT_KINDS) expect(scenesForKind(kind).length, kind).toBeGreaterThanOrEqual(2)
    expect(new Set(SCENES.map((s) => s.key)).size).toBe(SCENES.length)
    for (const s of SCENES) {
      expect(s.options).toHaveLength(3)
      expect(new Set(s.options.map((o) => o.key)).size).toBe(3)
      expect(s.options.some((o) => o.quality === 'wise'), s.key).toBe(true)
      for (const o of s.options) expect(o.key).toMatch(/^[a-z0-9-]{1,40}$/)
    }
  })
})
