import 'server-only'
import { getDb } from '../db'
import { env } from '../env'

/**
 * Fixed-window rate limiter backed by MongoDB (shared across instances).
 * Each window document carries a TTL so storage stays bounded.
 */
export type LimitRule = { bucket: string; limit: number; windowSec: number }

export const RULES = {
  login: { bucket: 'login', limit: 8, windowSec: 15 * 60 },
  register: { bucket: 'register', limit: 5, windowSec: 60 * 60 },
  reset: { bucket: 'reset', limit: 5, windowSec: 60 * 60 },
  oauth: { bucket: 'oauth', limit: 20, windowSec: 10 * 60 },
  turn: { bucket: 'turn', limit: 40, windowSec: 60 },
  aiTurn: { bucket: 'ai-turn', limit: 12, windowSec: 60 },
  aiEval: { bucket: 'ai-eval', limit: 6, windowSec: 10 * 60 },
  aiScenario: { bucket: 'ai-scenario', limit: 5, windowSec: 60 * 60 },
  start: { bucket: 'start', limit: 20, windowSec: 10 * 60 },
  contact: { bucket: 'contact', limit: 4, windowSec: 60 * 60 },
  account: { bucket: 'account', limit: 10, windowSec: 60 * 60 },
  admin: { bucket: 'admin', limit: 60, windowSec: 60 },
} satisfies Record<string, LimitRule>

export type LimitResult = { ok: boolean; remaining: number; retryAfterSec: number }

export async function rateLimit(rule: LimitRule, key: string): Promise<LimitResult> {
  if (!env().RATE_LIMIT_ENABLED) return { ok: true, remaining: rule.limit, retryAfterSec: 0 }
  const db = await getDb()
  const now = Date.now()
  const windowStart = Math.floor(now / (rule.windowSec * 1000)) * rule.windowSec * 1000
  const id = `${rule.bucket}:${key}:${windowStart}`
  const expiresAt = new Date(windowStart + rule.windowSec * 1000)
  const doc = await db.rateLimits.findOneAndUpdate(
    { _id: id },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, returnDocument: 'after' },
  )
  const count = doc?.count ?? 1
  return {
    ok: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSec: Math.ceil((expiresAt.getTime() - now) / 1000),
  }
}

export class RateLimitedError extends Error {
  constructor(public readonly retryAfterSec: number) {
    super('Too many requests')
    this.name = 'RateLimitedError'
  }
}

export async function enforce(rule: LimitRule, key: string) {
  const r = await rateLimit(rule, key)
  if (!r.ok) throw new RateLimitedError(r.retryAfterSec)
}
