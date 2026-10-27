import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, json, newKey, req, resetAll, signUp, useSession } from './harness'

async function makeRole(email: string, role: 'ADMIN' | 'CONTENT_MANAGER') {
  const { getDb } = await import('@/server/db')
  const db = await getDb()
  const u = await db.users.findOne({ email })
  await db.users.updateOne({ _id: u!._id }, { $set: { role } })
}

describe('admin authorisation', () => {
  beforeEach(() => resetAll())

  it('regular users cannot use admin endpoints', async () => {
    const { token } = await signUp('user@example.com')
    useSession(token)
    const { GET } = await import('@/app/api/admin/users/route')
    expect((await GET(req('/api/admin/users'), ctx())).status).toBe(403)
    const { PUT } = await import('@/app/api/admin/flags/route')
    expect((await PUT(req('/api/admin/flags', { method: 'PUT', body: { key: 'ai', enabled: false } }), ctx())).status).toBe(403)
  })

  it('content managers manage scenarios but not accounts', async () => {
    const { token } = await signUp('cm@example.com')
    await makeRole('cm@example.com', 'CONTENT_MANAGER')
    useSession(token)
    const { GET } = await import('@/app/api/admin/users/route')
    expect((await GET(req('/api/admin/users'), ctx())).status).toBe(403)
    const { PATCH } = await import('@/app/api/admin/scenarios/[slug]/route')
    const r = await PATCH(req('/api/admin/scenarios/buy-used-car', { method: 'PATCH', body: { published: false } }), ctx({ slug: 'buy-used-car' }))
    expect(r.status).toBe(200)
  })

  it('admins change roles through audited, validated operations and cannot change their own', async () => {
    const target = await signUp('target@example.com')
    const admin = await signUp('root@example.com')
    await makeRole('root@example.com', 'ADMIN')
    useSession(admin.token)
    const { PATCH } = await import('@/app/api/admin/users/[id]/route')
    const ok = await PATCH(req(`/api/admin/users/${target.user.id}`, { method: 'PATCH', body: { role: 'CONTENT_MANAGER' } }), ctx({ id: target.user.id }))
    expect(ok.status).toBe(200)
    const self = await PATCH(req(`/api/admin/users/${admin.user.id}`, { method: 'PATCH', body: { role: 'USER' } }), ctx({ id: admin.user.id }))
    expect(self.status).toBe(400)
    const bogus = await PATCH(req(`/api/admin/users/${target.user.id}`, { method: 'PATCH', body: { role: 'SUPERUSER' } }), ctx({ id: target.user.id }))
    expect(bogus.status).toBe(400)
    const { getDb } = await import('@/server/db')
    const db = await getDb()
    expect(await db.audit.countDocuments({ action: 'user.role_changed', targetId: target.user.id })).toBe(1)
    const { resolveSessionToken } = await import('@/server/auth/session')
    expect(await resolveSessionToken(target.token)).toBeNull()
  })

  it('suspended users lose their sessions', async () => {
    const target = await signUp('sus@example.com')
    const admin = await signUp('root2@example.com')
    await makeRole('root2@example.com', 'ADMIN')
    useSession(admin.token)
    const { PATCH } = await import('@/app/api/admin/users/[id]/route')
    await PATCH(req(`/api/admin/users/${target.user.id}`, { method: 'PATCH', body: { status: 'SUSPENDED' } }), ctx({ id: target.user.id }))
    const { resolveSessionToken } = await import('@/server/auth/session')
    expect(await resolveSessionToken(target.token)).toBeNull()
  })
})

describe('data export and deletion', () => {
  beforeEach(() => resetAll())

  it('exports a user’s data without secrets', async () => {
    const { token } = await signUp('exp@example.com')
    useSession(token)
    const { POST } = await import('@/app/api/games/route')
    await POST(req('/api/games', { body: { slug: 'buy-used-car' } }), ctx())
    const { GET } = await import('@/app/api/account/export/route')
    const res = await GET(req('/api/account/export'), ctx())
    expect(res.headers.get('content-disposition')).toContain('attachment')
    const body = await res.text()
    expect(body).toContain('exp@example.com')
    expect(body).not.toContain('argon2')
    expect(JSON.parse(body).games).toHaveLength(1)
  })

  it('deletes the account and its data after confirming the password', async () => {
    const { user, token } = await signUp('del@example.com')
    useSession(token)
    const { POST: start } = await import('@/app/api/games/route')
    const g = await json<{ id: string }>(await start(req('/api/games', { body: { slug: 'buy-used-car' } }), ctx()))
    const { POST } = await import('@/app/api/account/delete/route')
    expect((await POST(req('/api/account/delete', { body: { password: 'wrong' } }), ctx())).status).toBe(400)
    expect((await POST(req('/api/account/delete', { body: { password: 'Negotiate-2026!' } }), ctx())).status).toBe(200)
    const { getDb } = await import('@/server/db')
    const db = await getDb()
    expect(await db.users.findOne({ _id: user.id })).toBeNull()
    expect(await db.games.findOne({ _id: g.body.id })).toBeNull()
    expect(await db.sessions.countDocuments({ userId: user.id })).toBe(0)
  })
})

describe('analytics and preferences', () => {
  beforeEach(() => resetAll())

  it('dashboard and progress are computed from persisted games only', async () => {
    const { token } = await signUp('stats@example.com')
    useSession(token)
    const { GET: dash } = await import('@/app/api/dashboard/route')
    const empty = await json<{ progress: { gamesCompleted: number }; trend: unknown[] }>(await dash(req('/api/dashboard'), ctx()))
    expect(empty.body.progress.gamesCompleted).toBe(0)
    expect(empty.body.trend).toHaveLength(0)
    const { POST: start } = await import('@/app/api/games/route')
    const g = await json<{ id: string }>(await start(req('/api/games', { body: { slug: 'buy-used-car' } }), ctx()))
    const { POST: prep } = await import('@/app/api/games/[id]/prep/route')
    await prep(req(`/api/games/${g.body.id}/prep`, { body: { skip: true } }), ctx({ id: g.body.id }))
    const { POST: act } = await import('@/app/api/games/[id]/actions/route')
    await act(req(`/api/games/${g.body.id}/actions`, { body: { action: { type: 'WALK_AWAY' }, idempotencyKey: newKey() } }), ctx({ id: g.body.id }))
    const after = await json<{ progress: { gamesCompleted: number; walkAways: number }; trend: unknown[] }>(await dash(req('/api/dashboard'), ctx()))
    expect(after.body.progress.gamesCompleted).toBe(1)
    expect(after.body.progress.walkAways).toBe(1)
    const { GET: progress } = await import('@/app/api/progress/route')
    const p = await json<{ totals: { games: number }; byCategory: { category: string }[] }>(await progress(req('/api/progress?range=all&mode=CLASSIC'), ctx()))
    expect(p.body.totals.games).toBe(1)
    expect(p.body.byCategory[0]!.category).toBe('buying-selling')
    const none = await json<{ totals: { games: number } }>(await progress(req('/api/progress?range=all&mode=AI'), ctx()))
    expect(none.body.totals.games).toBe(0)
  })

  it('preferences accept only whitelisted fields', async () => {
    const { user, token } = await signUp('prefs@example.com')
    useSession(token)
    const { PATCH } = await import('@/app/api/account/preferences/route')
    await PATCH(req('/api/account/preferences', { method: 'PATCH', body: { theme: 'light', role: 'ADMIN', plan: 'PREMIUM' } }), ctx())
    const { getDb } = await import('@/server/db')
    const db = await getDb()
    expect((await db.preferences.findOne({ _id: user.id }))!.theme).toBe('light')
    const u = await db.users.findOne({ _id: user.id })
    expect(u!.role).toBe('USER')
    expect(u!.plan).toBe('FREE')
  })
})
