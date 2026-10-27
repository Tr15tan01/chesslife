import { describe, expect, it } from 'vitest'
import { SEED_SCENARIOS } from '@/server/content/index'
import { availableStatements, expire, initialState, step, matchFreeText, type PlayerAction } from '@/server/engine/engine'
import { cpIssueUtility, playerBetter, withinCounterpartLimits, type ScenarioContext } from '@/server/engine/utility'
import type { EngineState } from '@/lib/negotiation/types'

const ctxOf = (slug: string): ScenarioContext => {
  const s = SEED_SCENARIOS.find((x) => x.pub.slug === slug)!
  return { pub: s.pub, priv: s.priv }
}

function run(ctx: ScenarioContext, actions: PlayerAction[]) {
  let state = initialState(ctx)
  const results = []
  for (const a of actions) {
    const r = step(ctx, state, a)
    results.push(r)
    state = r.state
    if (r.status !== 'ACTIVE') break
  }
  return { state, results, last: results[results.length - 1]! }
}

describe('negotiation state machine', () => {
  const car = ctxOf('buy-used-car')

  it('ignores accept when no offer is on the table', () => {
    const r = step(car, initialState(car), { type: 'ACCEPT' })
    expect(r.status).toBe('ACTIVE')
    expect(r.state.turn).toBe(0)
  })

  it('walking away ends the game', () => {
    const { last } = run(car, [{ type: 'WALK_AWAY' }])
    expect(last.status).toBe('WALKED_AWAY')
    expect(last.outcome?.kind).toBe('PLAYER_WALKED')
  })

  it('accepting the counteroffer records exactly those terms', () => {
    const { last, state } = run(car, [{ type: 'MAKE_OFFER', terms: { price: 8000 } }, { type: 'ACCEPT' }])
    expect(last.status).toBe('AGREEMENT_REACHED')
    expect(last.outcome?.terms).toEqual(state.agreement)
    expect(state.agreement).toEqual(state.counterOffer)
  })

  it('extreme anchors cost rapport', () => {
    const start = initialState(car)
    const r = step(car, start, { type: 'MAKE_OFFER', terms: { price: 7000 } })
    expect(r.state.trust).toBeLessThan(start.trust)
  })

  it('accepts an offer at or above its target immediately', () => {
    const r = step(car, initialState(car), { type: 'MAKE_OFFER', terms: { price: 11000 } })
    expect(r.status).toBe('AGREEMENT_REACHED')
  })

  it('clamps offers to the issue range and step', () => {
    const r = step(car, initialState(car), { type: 'MAKE_OFFER', terms: { price: 123456.78 } })
    expect(r.state.offers[0]!.terms.price).toBe(12000)
  })

  it('rejects offers missing an issue', () => {
    const job = ctxOf('negotiate-job-offer')
    const r = step(job, initialState(job), { type: 'MAKE_OFFER', terms: { salary: 130000 } })
    expect(r.state.offers).toHaveLength(0)
    expect(r.turns[0]!.actor).toBe('system')
  })

  it('is deterministic', () => {
    const actions: PlayerAction[] = [{ type: 'ASK', questionKey: 'why-selling' }, { type: 'MAKE_OFFER', terms: { price: 8600 } }, { type: 'MAKE_OFFER', terms: { price: 8900 } }]
    expect(JSON.stringify(run(car, actions).state)).toBe(JSON.stringify(run(car, actions).state))
  })

  it('branching dialogue: commitment statements unlock only after discovery', () => {
    const s0 = initialState(car)
    expect(availableStatements(car, s0).some((s) => s.key === 'tyres')).toBe(false)
    const r = step(car, s0, { type: 'ASK', questionKey: 'inspect' })
    expect(r.state.discovered).toContain('tyres')
    expect(availableStatements(car, r.state).some((s) => s.key === 'tyres')).toBe(true)
  })

  it('deflects questions when rapport is too low, then answers later', () => {
    const low: EngineState = { ...initialState(car), trust: 10 }
    const r1 = step(car, low, { type: 'ASK', questionKey: 'why-selling' })
    expect(r1.state.discovered).not.toContain('moving')
    const r2 = step(car, { ...r1.state, trust: 60 }, { type: 'ASK', questionKey: 'why-selling' })
    expect(r2.state.discovered).toContain('moving')
  })

  it('counterpart never offers beyond its limits and never retracts', () => {
    for (const s of SEED_SCENARIOS) {
      const ctx = { pub: s.pub, priv: s.priv }
      let state = initialState(ctx)
      let prev: EngineState['counterOffer'] = null
      for (let k = 0; k < 30; k++) {
        const terms = Object.fromEntries(ctx.pub.issues.map((i) => [i.key, i.playerPrefers === 'higher' ? i.max : i.min]))
        const r = step(ctx, state, { type: 'MAKE_OFFER', terms })
        if (r.state.counterOffer) {
          expect(withinCounterpartLimits(ctx, r.state.counterOffer), s.pub.slug).toBe(true)
          if (prev) for (const i of ctx.pub.issues) expect(playerBetter(i, prev[i.key]!, r.state.counterOffer[i.key]!), `${s.pub.slug} retracted on ${i.key}`).toBe(false)
          prev = r.state.counterOffer
        }
        state = r.state
        if (r.status !== 'ACTIVE') break
      }
    }
  })

  it('a final offer that is ignored makes the counterpart walk', () => {
    let state = initialState(car)
    let final = false
    for (let k = 0; k < 20 && !final; k++) {
      const r = step(car, state, { type: 'MAKE_OFFER', terms: { price: 8500 } })
      state = r.state
      final = state.finalOfferIssued
      if (r.status !== 'ACTIVE') break
    }
    expect(final).toBe(true)
    const r = step(car, state, { type: 'ASK', questionKey: 'drive' })
    expect(r.status).toBe('FAILED')
    expect(r.outcome?.kind).toBe('COUNTERPART_WALKED')
  })

  it('pressure can drive the counterpart away', () => {
    let state = initialState(car)
    let status = 'ACTIVE'
    for (let k = 0; k < 10 && status === 'ACTIVE'; k++) {
      const r = step(car, state, { type: 'STATEMENT', statementKey: 'pressure' })
      state = r.state
      status = r.status
    }
    expect(status).toBe('FAILED')
  })

  it('stops at the turn limit without offers', () => {
    let state = initialState(car)
    let r = step(car, state, { type: 'ASK', questionKey: 'drive' })
    for (let k = 0; k < 100 && r.status === 'ACTIVE'; k++) {
      state = r.state
      r = step(car, state, { type: 'STATEMENT', statementKey: 'summary' })
    }
    expect(r.status).toBe('FAILED')
    expect(r.outcome?.kind).toBe('NO_DEAL')
  })

  it('expire() produces an EXPIRED outcome', () => {
    const r = expire(initialState(car))
    expect(r.status).toBe('EXPIRED')
  })

  it('keyword matching maps free text to a dialogue node, honestly', () => {
    expect(matchFreeText(car, initialState(car), 'So why are you selling it?')?.node.key).toBe('why-selling')
    expect(matchFreeText(car, initialState(car), 'Hello there')).toBeNull()
  })

  it('utility helpers treat limits as the zero point', () => {
    const issue = car.pub.issues[0]!
    expect(cpIssueUtility(car, issue, car.priv.counterpart.limit.price!)).toBeCloseTo(0)
    expect(cpIssueUtility(car, issue, car.priv.counterpart.target.price!)).toBeCloseTo(1)
  })
})
