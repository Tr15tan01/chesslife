import { describe, expect, it } from 'vitest'
import { characterResponseSchema, leaksHiddenNumbers, revealableFacts } from '@/server/ai/character'
import { blendEvaluation, evaluatorSchema } from '@/server/ai/evaluator'
import { extractJson } from '@/server/ai/providers'
import { SEED_SCENARIOS } from '@/server/content/index'
import { initialState, step } from '@/server/engine/engine'
import { evaluateGame } from '@/server/engine/evaluate'

const car = SEED_SCENARIOS.find((s) => s.pub.slug === 'buy-used-car')!

describe('AI structured output validation', () => {
  it('extracts JSON from fenced model output', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(() => extractJson('no json here')).toThrow()
  })

  it('validates character responses', () => {
    expect(characterResponseSchema.safeParse({ reply: 'Sure.', revealFactKey: null, signals: { empathy: true } }).success).toBe(true)
    expect(characterResponseSchema.safeParse({ reply: '' }).success).toBe(false)
    expect(characterResponseSchema.safeParse({ reply: 'x'.repeat(800) }).success).toBe(false)
  })

  it('rejects evaluator scores outside 0–100', () => {
    const dim = { score: 120, rationale: 'Too high to be valid.' }
    const bad = { dimensions: { information: dim, communication: dim, value: dim, composure: dim, relationship: dim } }
    expect(evaluatorSchema.safeParse(bad).success).toBe(false)
  })

  it('bounds AI influence to ±15 points around the rules score', () => {
    const ctx = { pub: car.pub, priv: car.priv }
    const r = step(ctx, initialState(ctx), { type: 'WALK_AWAY' })
    const rules = evaluateGame({ ctx, state: r.state, turns: [], prep: null, outcome: r.outcome! })
    const dim = { score: 100, rationale: 'Excellent communication throughout.' }
    const blended = blendEvaluation(rules, { dimensions: { information: dim, communication: dim, value: dim, composure: dim, relationship: dim }, strengths: [], suggestions: [] })
    for (const d of ['information', 'communication', 'value', 'composure', 'relationship'] as const) {
      expect(blended.dimensions[d].score - rules.dimensions[d].score).toBeLessThanOrEqual(8)
      expect(blended.dimensions[d].source).toBe('blended')
    }
    expect(blended.dimensions.outcome).toEqual(rules.dimensions.outcome)
    expect(blended.aiAssessed).toBe(true)
  })

  it('only offers facts the player has earned', () => {
    const low = { ...initialState({ pub: car.pub, priv: car.priv }), trust: 5 }
    expect(revealableFacts(car.priv, low).map((f) => f.key)).toEqual(['tyres'])
    const high = { ...low, trust: 90 }
    expect(revealableFacts(car.priv, high).length).toBe(car.priv.counterpart.facts.length)
  })

  it('detects replies that leak a hidden limit', () => {
    const state = initialState({ pub: car.pub, priv: car.priv })
    const base = { pub: car.pub, priv: car.priv, state, history: [], playerMessage: 'hi', playerOffer: null, decision: { kind: 'none' as const }, fallbackReply: 'Noted.' }
    expect(leaksHiddenNumbers(base, 'Honestly my floor is $8,900.')).toBe(true)
    expect(leaksHiddenNumbers(base, 'I could maybe do something.')).toBe(false)
  })
})
