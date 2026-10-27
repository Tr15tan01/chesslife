import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, jar, json, req, resetAll, signUp, useSession } from './harness'

describe('registration, login and sessions', () => {
  beforeEach(() => resetAll())

  it('registers, signs in and stores only a password hash', async () => {
    const { user } = await signUp('ana@example.com', 'Ana')
    expect(user.email).toBe('ana@example.com')
    expect(user.role).toBe('USER')
    const { getDb } = await import('@/server/db')
    const doc = await (await getDb()).users.findOne({ email: 'ana@example.com' })
    expect(doc!.passwordHash).toMatch(/^\$argon2id\$/)
    expect(JSON.stringify(doc)).not.toContain('Negotiate-2026!')
  })

  it('does not reveal whether an email is already registered', async () => {
    await signUp('dup@example.com')
    jar.clear()
    const { POST } = await import('@/app/api/auth/register/route')
    const r = await json(await POST(req('/api/auth/register', { body: { name: 'X', email: 'dup@example.com', password: 'Negotiate-2026!' } }), ctx()))
    expect(r.status).toBe(200)
    expect(r.body.signedIn).toBe(false)
    expect(jar.has('dc_session')).toBe(false)
  })

  it('ignores a client-supplied role on registration', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    await POST(req('/api/auth/register', { body: { name: 'Eve', email: 'eve@example.com', password: 'Negotiate-2026!', role: 'ADMIN' } }), ctx())
    const { getDb } = await import('@/server/db')
    expect((await (await getDb()).users.findOne({ email: 'eve@example.com' }))!.role).toBe('USER')
  })

  it('logs in with valid credentials and uses a generic error otherwise', async () => {
    await signUp('bo@example.com')
    jar.clear()
    const { POST } = await import('@/app/api/auth/login/route')
    const bad = await json<{ error: { message: string } }>(await POST(req('/api/auth/login', { body: { email: 'bo@example.com', password: 'wrong-password-1' } }), ctx()))
    const unknown = await json<{ error: { message: string } }>(await POST(req('/api/auth/login', { body: { email: 'nobody@example.com', password: 'wrong-password-1' } }), ctx()))
    expect(bad.status).toBe(401)
    expect(bad.body.error.message).toBe(unknown.body.error.message)
    const ok = await POST(req('/api/auth/login', { body: { email: 'bo@example.com', password: 'Negotiate-2026!' } }), ctx())
    expect(ok.status).toBe(200)
    expect(jar.get('dc_session')).toBeTruthy()
  })

  it('rate limits repeated login attempts', async () => {
    const { POST } = await import('@/app/api/auth/login/route')
    let last = 0
    for (let i = 0; i < 10; i++) last = (await POST(req('/api/auth/login', { body: { email: 'rl@example.com', password: 'x' } }), ctx())).status
    expect(last).toBe(429)
  })

  it('rejects cross-site mutations (CSRF)', async () => {
    const { token } = await signUp('csrf@example.com')
    useSession(token)
    const { POST } = await import('@/app/api/games/route')
    const r = await POST(req('/api/games', { body: { slug: 'buy-used-car' }, origin: 'https://evil.example' }), ctx())
    expect(r.status).toBe(403)
    const noOrigin = await POST(req('/api/games', { body: { slug: 'buy-used-car' }, origin: null }), ctx())
    expect(noOrigin.status).toBe(403)
  })

  it('requires a session for protected routes', async () => {
    const { GET } = await import('@/app/api/dashboard/route')
    expect((await GET(req('/api/dashboard'), ctx())).status).toBe(401)
  })

  it('password reset tokens are single use and rotate sessions', async () => {
    const { user, token } = await signUp('reset@example.com')
    const { getDb } = await import('@/server/db')
    const db = await getDb()
    const { randomToken, sha256 } = await import('@/server/security/crypto')
    const raw = randomToken(32)
    await db.authTokens.insertOne({ _id: crypto.randomUUID(), type: 'PASSWORD_RESET', tokenHash: sha256(raw), userId: user.id, expiresAt: new Date(Date.now() + 60000), usedAt: null, createdAt: new Date() })
    const { resetPassword } = await import('@/server/services/accounts')
    await resetPassword(raw, 'Brand-new-pass-9')
    await expect(resetPassword(raw, 'Another-pass-99')).rejects.toThrow(/invalid or has expired/)
    const { resolveSessionToken } = await import('@/server/auth/session')
    expect(await resolveSessionToken(token)).toBeNull()
  })

  it('logout ends the session', async () => {
    const { token } = await signUp('out@example.com')
    useSession(token)
    const { POST } = await import('@/app/api/auth/logout/route')
    await POST(req('/api/auth/logout', { body: {} }), ctx())
    const { resolveSessionToken } = await import('@/server/auth/session')
    expect(await resolveSessionToken(token)).toBeNull()
  })

  it('bootstraps ADMIN_EMAILS only after verification', async () => {
    await resetAll({ ADMIN_EMAILS: 'boss@example.com' })
    const { user } = await signUp('boss@example.com')
    expect(user.role).toBe('USER')
    const { getDb } = await import('@/server/db')
    const db = await getDb()
    const { randomToken, sha256 } = await import('@/server/security/crypto')
    const raw = randomToken(32)
    await db.authTokens.insertOne({ _id: crypto.randomUUID(), type: 'EMAIL_VERIFY', tokenHash: sha256(raw), userId: user.id, expiresAt: new Date(Date.now() + 60000), usedAt: null, createdAt: new Date() })
    const { verifyEmail } = await import('@/server/services/accounts')
    const verified = await verifyEmail(raw)
    expect(verified!.role).toBe('ADMIN')
  })
})

describe('Google sign-in configuration', () => {
  beforeEach(() => resetAll())

  it('is disabled when GOOGLE_AUTH_ENABLED=0', async () => {
    const { googleConfig } = await import('@/server/env')
    expect(googleConfig().enabled).toBe(false)
    const { GET } = await import('@/app/api/auth/google/start/route')
    const r = await GET(req('/api/auth/google/start'))
    expect(r.headers.get('location')).toContain('/login?error=google-disabled')
  })

  it('fails safely when enabled without credentials', async () => {
    await resetAll({ GOOGLE_AUTH_ENABLED: '1' })
    const { googleConfig } = await import('@/server/env')
    expect(googleConfig().enabled).toBe(false)
  })

  it('builds a PKCE authorisation request when enabled', async () => {
    await resetAll({ GOOGLE_AUTH_ENABLED: '1', GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'secret' })
    const { GET } = await import('@/app/api/auth/google/start/route')
    const r = await GET(req('/api/auth/google/start?next=//evil.example'))
    const loc = new URL(r.headers.get('location')!)
    expect(loc.hostname).toBe('accounts.google.com')
    expect(loc.searchParams.get('code_challenge_method')).toBe('S256')
    expect(loc.searchParams.get('state')).toBeTruthy()
    expect(loc.searchParams.get('nonce')).toBeTruthy()
    expect(loc.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/google/callback')
    const cookie = r.headers.get('set-cookie')!
    expect(cookie).toContain('dc_oauth=')
    expect(cookie.toLowerCase()).toContain('httponly')
    const { readOAuthState } = await import('@/server/auth/google')
    const st = readOAuthState(decodeURIComponent(cookie.split(';')[0]!.split('=').slice(1).join('=')), loc.searchParams.get('state'))
    expect(st?.next).toBe('/dashboard')
    expect(readOAuthState(decodeURIComponent(cookie.split(';')[0]!.split('=').slice(1).join('=')), 'forged')).toBeNull()
  })

  it('never auto-links to an existing account by email', async () => {
    await signUp('linked@example.com')
    const { resolveGoogleLogin } = await import('@/server/services/accounts')
    const res = await resolveGoogleLogin({ sub: 'g-1', email: 'linked@example.com', emailVerified: true, name: 'L', picture: null }, null)
    expect(res).toEqual({ error: 'link-required' })
    const unverified = await resolveGoogleLogin({ sub: 'g-2', email: 'new@example.com', emailVerified: false, name: 'N', picture: null }, null)
    expect(unverified).toEqual({ error: 'unverified' })
    const created = await resolveGoogleLogin({ sub: 'g-3', email: 'fresh@example.com', emailVerified: true, name: 'F', picture: null }, null)
    expect('user' in created && created.user.emailVerified).toBeTruthy()
  })
})
