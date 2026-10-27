import 'server-only'
import { getDb } from '../db'
import { aiConfigured } from '../ai/providers'
import type { Plan } from '../db/models'

/**
 * Server-side feature flags (admin-editable) layered on top of environment
 * configuration. A flag can only switch a capability off that the
 * environment allows; it can never enable AI without AI_ENABLED=1.
 */
export const FLAG_DEFS = {
  ai: { label: 'AI negotiation and coaching', default: true },
  aiEvaluation: { label: 'AI qualitative evaluation', default: true },
  customScenarios: { label: 'Custom scenario builder', default: true },
  aiScenarioGeneration: { label: 'AI-assisted custom scenario flavour', default: true },
  registration: { label: 'New account registration', default: true },
  freeDailyAiTurns: { label: 'Free plan: AI turns per day', default: true, value: 40 },
  premiumDailyAiTurns: { label: 'Premium plan: AI turns per day', default: true, value: 300 },
} as const

export type FlagKey = keyof typeof FLAG_DEFS

export async function getFlags(): Promise<Record<FlagKey, { enabled: boolean; value?: number }>> {
  const db = await getDb()
  const docs = await db.flags.find({})
  const out = {} as Record<FlagKey, { enabled: boolean; value?: number }>
  for (const [k, def] of Object.entries(FLAG_DEFS) as [FlagKey, (typeof FLAG_DEFS)[FlagKey]][]) {
    const d = docs.find((x) => x._id === k)
    out[k] = { enabled: d?.enabled ?? def.default, value: d?.value ?? ('value' in def ? def.value : undefined) }
  }
  return out
}

export async function aiAvailable(): Promise<boolean> {
  if (!aiConfigured()) return false
  return (await getFlags()).ai.enabled
}

export async function dailyAiTurnLimit(plan: Plan): Promise<number> {
  const f = await getFlags()
  return (plan === 'PREMIUM' ? f.premiumDailyAiTurns.value : f.freeDailyAiTurns.value) ?? 40
}
