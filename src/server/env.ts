import 'server-only'
import { z } from 'zod'

/**
 * Server-only configuration. Nothing in here may be imported from a Client
 * Component (the `server-only` import enforces this at build time).
 *
 * Mandatory: DATABASE_URL, AUTH_SECRET (production), AUTH_URL (production).
 * Optional integrations (Google sign-in, AI, email) are validated lazily when
 * the feature is invoked so a missing optional integration never breaks boot.
 */

const flag = z
  .enum(['0', '1', 'true', 'false'])
  .optional()
  .transform((v) => v === '1' || v === 'true')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_SECRET: z.string().optional(),
  AUTH_URL: z.string().url().optional(),
  GOOGLE_AUTH_ENABLED: flag,
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  AI_ENABLED: flag,
  AI_PROVIDER: z.enum(['google', 'openai', 'anthropic', 'mock', '']).optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL_NEGOTIATION: z.string().optional(),
  AI_MODEL_EVALUATION: z.string().optional(),
  AI_MODEL_SCENARIO: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  RATE_LIMIT_ENABLED: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((v) => v === undefined || v === '1' || v === 'true'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export function env(): Env {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new ConfigError(`Invalid server configuration: ${issues}`)
  }
  const e = parsed.data
  if (e.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    if (!e.AUTH_SECRET || e.AUTH_SECRET.length < 32) {
      throw new ConfigError('AUTH_SECRET must be set to at least 32 random characters in production.')
    }
    if (e.DATABASE_URL.startsWith('memory://') && process.env.DEALCRAFT_ALLOW_MEMORY_DB !== '1') {
      throw new ConfigError('The in-memory database is for development and tests only. Set a MongoDB Atlas DATABASE_URL.')
    }
  }
  cached = e
  return e
}

/** Reset cached config (tests only). */
export function resetEnvCache() {
  cached = null
}

export function authSecret(): string {
  const e = env()
  if (e.AUTH_SECRET && e.AUTH_SECRET.length >= 32) return e.AUTH_SECRET
  if (e.NODE_ENV === 'production') throw new ConfigError('AUTH_SECRET is not configured.')
  // Development fallback only — never used in production (see env()).
  return 'dev-only-insecure-secret-change-me-0123456789abcdef'
}

export function appUrl(): string {
  const e = env()
  return (e.AUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

export function isSecureCookies(): boolean {
  return appUrl().startsWith('https://')
}

export type GoogleConfig = { enabled: false } | { enabled: true; clientId: string; clientSecret: string }

/**
 * GOOGLE_AUTH_ENABLED=1 turns the provider on. If it is on but credentials are
 * missing we fail safely: the provider stays off and a server-side error is
 * logged; the client only sees "Google sign-in is unavailable".
 */
export function googleConfig(): GoogleConfig {
  const e = env()
  if (!e.GOOGLE_AUTH_ENABLED) return { enabled: false }
  if (!e.GOOGLE_CLIENT_ID || !e.GOOGLE_CLIENT_SECRET) {
    console.error('[config] GOOGLE_AUTH_ENABLED=1 but GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are missing. Google sign-in is disabled.')
    return { enabled: false }
  }
  return { enabled: true, clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET }
}

export function isGoogleEnabled(): boolean {
  return googleConfig().enabled
}

export function adminEmails(): string[] {
  return (env().ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function emailConfigured(): boolean {
  const e = env()
  return Boolean(e.RESEND_API_KEY && e.EMAIL_FROM)
}
