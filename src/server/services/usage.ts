import 'server-only'
import { getDb } from '../db'
import type { Plan, UsageKind } from '../db/models'
import { estimateCostMicros, type CompletionResult } from '../ai/providers'
import { AppError } from '../http'
import { dailyAiTurnLimit } from './flags'

export const today = () => new Date().toISOString().slice(0, 10)

export function checkQuota(used: number, limit: number): { ok: boolean; remaining: number } {
  return { ok: used < limit, remaining: Math.max(0, limit - used) }
}

export async function aiTurnsUsedToday(userId: string): Promise<number> {
  const db = await getDb()
  return db.usage.countDocuments({ userId, kind: 'AI_TURN', day: today() })
}

export async function assertAiQuota(userId: string, plan: Plan) {
  const [used, limit] = await Promise.all([aiTurnsUsedToday(userId), dailyAiTurnLimit(plan)])
  if (!checkQuota(used, limit).ok) {
    throw new AppError(429, 'AI_QUOTA', `You have used today's ${limit} AI turns. Classic mode is unlimited, or come back tomorrow.`)
  }
}

/** Token counts come from the provider response, never from the client. */
export async function recordUsage(userId: string, kind: UsageKind, usage: Pick<CompletionResult, 'provider' | 'model' | 'inputTokens' | 'outputTokens'>, ok: boolean) {
  const db = await getDb()
  await db.usage.insertOne({
    _id: crypto.randomUUID(),
    userId,
    kind,
    day: today(),
    provider: usage.provider,
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costMicros: estimateCostMicros(usage.provider, usage.inputTokens, usage.outputTokens),
    ok,
    createdAt: new Date(),
  })
}
