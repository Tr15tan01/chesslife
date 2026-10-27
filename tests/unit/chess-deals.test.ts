import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { buildDealContext, drawAccepted, legalAfterRemoval, planQueenTrade, planTakeback, removablePawns, removalFor, wantsQueenTrade } from '@/server/chess/deals'
import { initialState, step } from '@/server/engine/engine'
import { opponentByKey } from '@/lib/chess/opponents'
import { trackPieces } from '@/lib/chess/pieces'
import type { ChessMoveView } from '@/lib/chess/types'

const START = new Chess().fen()
const dana = opponentByKey('dana')!
const victor = opponentByKey('victor')!
const sam = opponentByKey('sam')!

describe('board removals', () => {
  it('refuses removals that would leave the side that just moved in check', () => {
    // White to move; taking the a2 pawn away would put the black king in check from the rook.
    const fen = 'k7/8/8/8/8/8/P7/R3K3 w - - 0 1'
    expect(legalAfterRemoval(fen, ['a2'])).toBe(false)
    expect(removablePawns(fen, 'w', [], 3)).toEqual([])
    expect(legalAfterRemoval(START, ['a2', 'h2'])).toBe(true)
  })

  it('offers the least valuable pawns first', () => {
    expect(removablePawns(START, 'w', [], 3)).toEqual(['a2', 'h2', 'b2'])
    expect(removablePawns(START, 'b', [], 2)).toEqual(['a7', 'h7'])
  })
})

describe('deal plans', () => {
  it('prices takebacks by opponent level and the size of the mistake', () => {
    expect(planTakeback(START, 'w', sam, 9, 'opponent')).toMatchObject({ target: 1, limit: 0 })
    expect(planTakeback(START, 'w', dana, 1, 'player')).toMatchObject({ target: 2, limit: 0 })
    expect(planTakeback(START, 'w', victor, 9, 'player')).toMatchObject({ target: 3, limit: 2 })
    expect(planTakeback('k7/8/8/8/8/8/P7/R3K3 w - - 0 1', 'w', dana, 3, 'player')).toBeNull()
  })

  it('plans a queen trade with both queens and optional pawns', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    const spec = planQueenTrade(fen, 'w', victor, 3)!
    expect(spec.fixed).toEqual(['d1', 'd8'])
    expect(spec.max).toBe(2)
    expect(spec.playerBehind).toBe(true)
    expect(removalFor(spec, { pawns: 1 })).toEqual(['d1', 'd8', 'a7'])
    expect(planQueenTrade('k7/8/8/8/8/8/8/K7 w - - 0 1', 'w', victor, 3)).toBeNull()
  })

  it('decides draws and queen trades from the position', () => {
    expect(drawAccepted(1, 1.5)).toBe(true)
    expect(drawAccepted(3, 0)).toBe(false)
    expect(drawAccepted(3, -2)).toBe(true)
    expect(wantsQueenTrade(victor, 3, 10)).toBe(true)
    expect(wantsQueenTrade(victor, 0, 10)).toBe(false)
    expect(wantsQueenTrade(sam, 0, 12)).toBe(true)
  })
})

describe('deals run on the shared negotiation engine', () => {
  it('counters a lowball takeback offer and accepts at its price', () => {
    const spec = planTakeback(START, 'w', dana, 1, 'player')!
    const ctx = buildDealContext(spec, dana)
    const s0 = initialState(ctx)
    s0.counterOffer = { pawns: spec.opening }
    const low = step(ctx, s0, { type: 'MAKE_OFFER', terms: { pawns: 0 } })
    expect(low.status).toBe('ACTIVE')
    expect(low.state.counterOffer!.pawns).toBeGreaterThan(0)
    const yes = step(ctx, low.state, { type: 'ACCEPT' })
    expect(yes.status).toBe('AGREEMENT_REACHED')
    expect(yes.outcome?.terms).toEqual(low.state.counterOffer)
  })

  it('lets rapport and discovered facts lower the price', () => {
    const spec = planTakeback(START, 'w', sam, 1, 'player')!
    const ctx = buildDealContext(spec, sam)
    let s = initialState(ctx)
    s.counterOffer = { pawns: spec.opening }
    for (const key of ['precedent', 'why']) s = step(ctx, s, { type: 'ASK', questionKey: key }).state
    expect(s.discovered).toContain('fun')
    // Holding firm at zero: the engine concedes over time, down to the floor the fact unlocked.
    let r = step(ctx, s, { type: 'MAKE_OFFER', terms: { pawns: 0 } })
    for (let i = 0; i < 8 && r.status === 'ACTIVE'; i++) r = step(ctx, r.state, r.state.counterOffer?.pawns === 0 ? { type: 'ACCEPT' } : { type: 'MAKE_OFFER', terms: { pawns: 0 } })
    expect(r.status).toBe('AGREEMENT_REACHED')
    expect(r.outcome?.terms).toEqual({ pawns: 0 })
  })
})

describe('piece tracker with deals', () => {
  it('skips taken-back moves and removes pieces at their place in the timeline', () => {
    const c = new Chess()
    const moves: ChessMoveView[] = ['e4', 'e5', 'Qh5', 'Nc6'].map((san, ply) => {
      const m = c.move(san)
      return { ply, color: m.color, san: m.san, from: m.from, to: m.to, piece: m.piece, flags: m.flags, check: false }
    })
    moves[2]!.undone = true
    moves[3]!.undone = true
    const p = trackPieces(moves, [{ afterMove: 4, remove: ['a2'], reason: 'TAKEBACK' }])
    expect(p.find((x) => x.id === 'wd1')!.square).toBe('d1')
    expect(p.find((x) => x.id === 'bb8')!.square).toBe('b8')
    expect(p.find((x) => x.id === 'wa2')).toMatchObject({ square: null, last: 'a2' })
  })
})
