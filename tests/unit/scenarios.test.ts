import { describe, expect, it } from 'vitest'
import { SEED_SCENARIOS, validateScenario } from '@/server/content/index'
import { CATEGORIES } from '@/lib/negotiation/types'
import { buildCustomScenario } from '@/server/services/custom'

describe('seeded scenario library', () => {
  it('has at least 20 valid scenarios with unique slugs', () => {
    expect(SEED_SCENARIOS.length).toBeGreaterThanOrEqual(20)
    const slugs = SEED_SCENARIOS.map((s) => s.pub.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of SEED_SCENARIOS) expect(validateScenario(s), s.pub.slug).toEqual([])
  })

  it('covers every category', () => {
    for (const c of CATEGORIES) expect(SEED_SCENARIOS.some((s) => s.pub.category === c)).toBe(true)
  })

  it('keeps hidden counterpart data out of the public half', () => {
    for (const s of SEED_SCENARIOS) {
      const pub = JSON.stringify(s.pub)
      for (const f of s.priv.counterpart.facts) expect(pub.includes(f.label), `${s.pub.slug} leaks ${f.key}`).toBe(false)
      expect(pub).not.toContain('"firmness"')
      expect(pub).not.toContain('"walkTrust"')
      expect(pub).not.toContain(s.priv.counterpart.privateNotes)
    }
  })

  it('includes a scenario where walking away is best', () => {
    expect(SEED_SCENARIOS.some((s) => s.priv.rubric.walkAwayIsBest)).toBe(true)
  })

  it('rejects inverted counterpart limits', () => {
    const s = structuredClone(SEED_SCENARIOS[0]!)
    const key = s.pub.issues[0]!.key
    ;[s.priv.counterpart.target[key], s.priv.counterpart.limit[key]] = [s.priv.counterpart.limit[key]!, s.priv.counterpart.target[key]!]
    expect(validateScenario(s).join(' ')).toMatch(/inverted/)
  })

  it('builds valid custom scenarios at every difficulty', () => {
    for (const difficulty of [1, 2, 3, 4] as const) {
      const built = buildCustomScenario(
        {
          title: 'Contract renewal',
          context: 'Renewing an annual design retainer with a long-standing client.',
          role: 'Designer',
          counterpartRole: 'Client',
          objectives: 'Raise the retainer and keep scope stable.',
          desiredOutcome: 'A 10% increase.',
          difficulty,
          issues: [
            { label: 'Monthly fee', unit: 'currency', prefers: 'higher', min: 2000, max: 6000, target: 4500, limit: 3200 },
            { label: 'Notice period', unit: 'weeks', prefers: 'higher', min: 1, max: 12, target: 8, limit: 4 },
          ],
          useAi: false,
        },
        `custom-test-${difficulty}`,
      )
      expect(validateScenario(built)).toEqual([])
    }
  })
})
