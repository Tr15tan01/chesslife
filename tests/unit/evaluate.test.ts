import { describe, expect, it } from 'vitest'
import { SEED_SCENARIOS } from '@/server/content/index'
import { initialState, step, type PlayerAction } from '@/server/engine/engine'
import { checkChallenge, evaluateGame } from '@/server/engine/evaluate'
import { DIMENSIONS, type Turn } from '@/lib/negotiation/types'
import type { ScenarioContext } from '@/server/engine/utility'

const ctxOf = (slug: string): ScenarioContext => {
  const s = SEED_SCENARIOS.find((x) => x.pub.slug === slug)!
  return { pub: s.pub, priv: s.priv }
}

function play(ctx: ScenarioContext, actions: PlayerAction[]) {
  let state = initialState(ctx)
  const turns: Turn[] = []
  let outcome = null as ReturnType<typeof step>['outcome']
  for (const a of actions) {
    const r = step(ctx, state, a)
    r.turns.forEach((t) => turns.push({ ...t, idx: turns.length, at: '' }))
    state = r.state
    outcome = r.outcome
    if (r.status !== 'ACTIVE') break
  }
  return evaluateGame({ ctx, state, turns, prep: null, outcome: outcome ?? { kind: 'NO_DEAL', terms: null } })
}

describe('deterministic evaluation', () => {
  it('produces bounded scores for every dimension with rationales', () => {
    const e = play(ctxOf('buy-used-car'), [{ type: 'MAKE_OFFER', terms: { price: 8600 } }, { type: 'ACCEPT' }])
    for (const d of DIMENSIONS) {
      expect(e.dimensions[d].score).toBeGreaterThanOrEqual(0)
      expect(e.dimensions[d].score).toBeLessThanOrEqual(100)
      expect(e.dimensions[d].rationale.length).toBeGreaterThan(5)
      expect(e.dimensions[d].source).toBe('rules')
    }
    expect(e.suggestions).toHaveLength(3)
    expect(e.aiAssessed).toBe(false)
  })

  it('rewards walking away when no deal beats the alternative', () => {
    const ctx = ctxOf('know-when-to-walk')
    const walked = play(ctx, [{ type: 'ASK', questionKey: 'budget' }, { type: 'WALK_AWAY' }])
    const caved = play(ctx, [{ type: 'MAKE_OFFER', terms: { price: 3000 } }, { type: 'ACCEPT' }])
    expect(walked.facts.walkAwayWasBest).toBe(true)
    expect(walked.dimensions.outcome.score).toBeGreaterThan(80)
    expect(caved.facts.outcome).toBe('AGREEMENT')
    expect(caved.dimensions.outcome.score).toBeLessThan(35)
    expect(caved.facts.respectedOwnLimit).toBe(false)
  })

  it('discovering hidden facts raises information gathering', () => {
    const ctx = ctxOf('buy-used-car')
    const blind = play(ctx, [{ type: 'MAKE_OFFER', terms: { price: 9000 } }, { type: 'ACCEPT' }])
    const curious = play(ctx, [{ type: 'ASK', questionKey: 'inspect' }, { type: 'ASK', questionKey: 'why-selling' }, { type: 'MAKE_OFFER', terms: { price: 9000 } }, { type: 'ACCEPT' }])
    expect(curious.dimensions.information.score).toBeGreaterThan(blind.dimensions.information.score)
    expect(curious.facts.discovered).toBe(2)
  })

  it('accepting the first number scores poorly on offer strategy', () => {
    const e = play(ctxOf('buy-used-car'), [{ type: 'ASK', questionKey: 'proposal' }, { type: 'ACCEPT' }])
    expect(e.dimensions.offers.score).toBeLessThanOrEqual(30)
    expect(e.missed.join(' ')).toMatch(/counteroffer/)
  })

  it('reveals hidden limits only in the evaluation', () => {
    const ctx = ctxOf('buy-used-car')
    const e = play(ctx, [{ type: 'WALK_AWAY' }])
    expect(e.revealed.counterpartLimits).toEqual(ctx.priv.counterpart.limit)
  })

  it('checks challenge criteria objectively', () => {
    const ctx = ctxOf('buy-used-car')
    const e = play(ctx, [{ type: 'MAKE_OFFER', terms: { price: 11000 } }])
    const res = checkChallenge(e, { requireAgreement: true, limitIssue: { key: 'price', max: 9300 } }, ctx)
    expect(res.find((c) => c.label.includes('agreement'))!.met).toBe(true)
    expect(res.find((c) => c.label.includes('Price'))!.met).toBe(false)
  })
})
