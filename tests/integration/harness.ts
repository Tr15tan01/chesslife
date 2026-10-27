import { vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Integration harness: an in-memory MongoDB-compatible store plus a fake
 * cookie jar standing in for next/headers, so real Route Handlers and
 * services run unmodified.
 */
export const jar = new Map<string, string>()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined),
    has: (n: string) => jar.has(n),
    set: (n: string, v: string) => void jar.set(n, v),
    delete: (n: string | { name: string }) => void jar.delete(typeof n === 'string' ? n : n.name),
  }),
  headers: async () => new Headers({ 'user-agent': 'vitest' }),
}))

export async function resetAll(env: Record<string, string> = {}) {
  jar.clear()
  Object.assign(process.env, { AI_ENABLED: '0', AI_PROVIDER: '', GOOGLE_AUTH_ENABLED: '0', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', RATE_LIMIT_ENABLED: '1', ADMIN_EMAILS: '' }, env)
  const { resetEnvCache } = await import('@/server/env')
  const { resetMemoryStore } = await import('@/server/db/memory')
  const { resetDbForTests } = await import('@/server/db')
  resetEnvCache()
  resetMemoryStore()
  resetDbForTests()
}

export function req(path: string, init: { method?: string; body?: unknown; origin?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (init.origin !== null) headers.origin = init.origin ?? 'http://localhost:3000'
  return new NextRequest(`http://localhost:3000${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

export const ctx = <P extends Record<string, string>>(params: P = {} as P) => ({ params: Promise.resolve(params) })

export async function json<T = Record<string, unknown>>(res: Response): Promise<{ status: number; body: T }> {
  return { status: res.status, body: (await res.json()) as T }
}

/** Register through the real route and return the session user. */
export async function signUp(email: string, name = 'Test User') {
  const { POST } = await import('@/app/api/auth/register/route')
  const r = await json(await POST(req('/api/auth/register', { body: { name, email, password: 'Negotiate-2026!' } }), ctx()))
  if (r.status !== 200) throw new Error(`register failed: ${JSON.stringify(r.body)}`)
  const { getSessionUser } = await import('@/server/auth/session')
  const user = await getSessionUser()
  if (!user) throw new Error('no session after register')
  return { user, token: jar.get('dc_session')! }
}

export function useSession(token: string | undefined) {
  if (token) jar.set('dc_session', token)
  else jar.delete('dc_session')
}

export const newKey = () => crypto.randomUUID().replace(/-/g, '')
