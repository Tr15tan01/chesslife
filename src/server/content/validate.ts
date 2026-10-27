import { z } from 'zod'
import { CATEGORIES, DIMENSIONS } from '@/lib/negotiation/types'
import type { BuiltScenario } from './kit'
import { zopaExists } from '../engine/utility'

const issueSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]{0,30}$/),
  label: z.string().min(1).max(60),
  unit: z.enum(['currency', 'percent', 'days', 'weeks', 'months', 'hours', 'count', 'clock', 'choice']),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  playerPrefers: z.enum(['higher', 'lower']),
})

const publicSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
  title: z.string().min(3).max(100),
  summary: z.string().min(10).max(240),
  description: z.string().min(20).max(1200),
  category: z.enum(CATEGORIES),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  issues: z.array(issueSchema).min(1).max(4),
  maxTurns: z.number().int().min(3).max(30),
  estMinutes: z.number().int().min(1).max(30),
  opening: z.string().min(1).max(400),
})

/** Validates a built scenario. Returns a list of human-readable problems (empty = valid). */
export function validateScenario(s: BuiltScenario): string[] {
  const errors: string[] = []
  const parsed = publicSchema.safeParse(s.pub)
  if (!parsed.success) errors.push(...parsed.error.issues.map((i) => `public.${i.path.join('.')}: ${i.message}`))
  const keys = s.pub.issues.map((i) => i.key)
  if (new Set(keys).size !== keys.length) errors.push('Issue keys must be unique')
  const cp = s.priv.counterpart
  for (const issue of s.pub.issues) {
    if (issue.min >= issue.max) errors.push(`${issue.key}: min must be below max`)
    const inRange = (v: number | undefined, label: string) => {
      if (v === undefined || v < issue.min || v > issue.max) errors.push(`${issue.key}: ${label} out of range`)
    }
    inRange(s.pub.brief.limits[issue.key], 'player limit')
    inRange(s.pub.brief.suggestedTargets[issue.key], 'player target')
    inRange(cp.target[issue.key], 'counterpart target')
    inRange(cp.limit[issue.key], 'counterpart limit')
    inRange(cp.opening[issue.key], 'counterpart opening')
    const t = cp.target[issue.key]!
    const l = cp.limit[issue.key]!
    // Counterpart target must be worse for the player than its limit.
    if (issue.playerPrefers === 'higher' ? t > l : t < l) errors.push(`${issue.key}: counterpart target/limit are inverted`)
    if (cp.weights[issue.key] === undefined) errors.push(`${issue.key}: missing counterpart weight`)
  }
  const wsum = Object.values(cp.weights).reduce((a, b) => a + b, 0)
  if (Math.abs(wsum - 1) > 1e-6) errors.push('Counterpart weights must sum to 1')
  if (cp.firmness <= 0 || cp.floor < 0 || cp.floor > 0.9) errors.push('Counterpart firmness/floor out of range')
  if (cp.patience >= s.pub.maxTurns) errors.push('Patience must be below maxTurns')
  const factKeys = new Set(cp.facts.map((f) => f.key))
  for (const q of s.priv.questions) {
    if (q.reveals && !factKeys.has(q.reveals)) errors.push(`Question ${q.key} reveals unknown fact ${q.reveals}`)
    if (q.requires && !factKeys.has(q.requires)) errors.push(`Question ${q.key} requires unknown fact ${q.requires}`)
  }
  for (const st of s.priv.statements) if (st.requires && !factKeys.has(st.requires)) errors.push(`Statement ${st.key} requires unknown fact ${st.requires}`)
  for (const k of s.priv.rubric.requiredDiscoveries) {
    if (!factKeys.has(k)) errors.push(`Rubric requires unknown fact ${k}`)
    if (!s.priv.questions.some((q) => q.reveals === k)) errors.push(`Required fact ${k} has no question that reveals it`)
  }
  for (const d of DIMENSIONS) if (!(s.priv.rubric.weights[d]! > 0)) errors.push(`Rubric weight for ${d} must be positive`)
  const zopa = zopaExists({ pub: s.pub, priv: s.priv })
  if (!zopa && !s.priv.rubric.walkAwayIsBest) errors.push('No zone of agreement exists but walkAwayIsBest is false')
  if (zopa && s.priv.rubric.walkAwayIsBest) errors.push('walkAwayIsBest is set but an agreement zone exists')
  return errors
}
