import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, json, newKey, req, resetAll, signUp, useSession } from './harness'
import type { GameView } from '@/lib/negotiation/view'

async function start(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/games/route')
  return json<{ id: string; error?: { code: string } }>(await POST(req('/api/games', { body }), ctx()))
}
async function prep(id: string) {
  const { POST } = await import('@/app/api/games/[id]/prep/route')
  return json<GameView>(await POST(req(`/api/games/${id}/prep`, { body: { skip: true } }), ctx({ id })))
}
async function act(id: string, action: Record<string, unknown>, key = newKey(), expectedVersion?: number) {
  const { POST } = await import('@/app/api/games/[id]/actions/route')
  return json<GameView & { error?: { code: string; message: string } }>(await POST(req(`/api/games/${id}/actions`, { body: { action, idempotencyKey: key, expectedVersion } }), ctx({ id })))
}

describe('Classic gameplay through the API', () => {
  beforeEach(() => resetAll())

  it('plays a complete negotiation and persists the evaluation', async () => {
    const { token } = await signUp('player@example.com')
    useSession(token)
    const g = await start({ slug: 'buy-used-car', mode: 'CLASSIC' })
    expect(g.status).toBe(200)
    const p = await prep(g.body.id)
    expect(p.body.status).toBe('ACTIVE')
    const a1 = await act(g.body.id, { type: 'ASK', questionKey: 'inspect' })
    expect(a1.body.discovered.map((d) => d.key)).toContain('tyres')
    const a2 = await act(g.body.id, { type: 'MAKE_OFFER', terms: { price: 8600 } })
    expect(a2.body.counterOffer?.price).toBeGreaterThan(8600)
    const a3 = await act(g.body.id, { type: 'ACCEPT' })
    expect(a3.body.status).toBe('AGREEMENT_REACHED')

    const { GET } = await import('@/app/api/games/[id]/result/route')
    const r = await json<{ evaluation: { overall: number; facts: { offersMade: number } } }>(await GET(req(`/api/games/${g.body.id}/result`), ctx({ id: g.body.id })))
    expect(r.status).toBe(200)
    expect(r.body.evaluation.overall).toBeGreaterThan(0)
    expect(r.body.evaluation.facts.offersMade).toBe(1)

    const { getDb } = await import('@/server/db')
    const db = await getDb()
    const progress = await db.progress.findOne({ _id: a3.body.id ? (await db.games.findOne({ _id: g.body.id }))!.userId : '' })
    expect(progress?.gamesCompleted).toBe(1)
    const game = await db.games.findOne({ _id: g.body.id })
    expect(game!.state.offers.length).toBeGreaterThanOrEqual(2)
    expect(game!.progressApplied).toBe(true)
  })

  it('never exposes hidden counterpart data in the game view', async () => {
    const { token } = await signUp('peek@example.com')
    useSession(token)
    const g = await start({ slug: 'buy-used-car' })
    const { GET } = await import('@/app/api/games/[id]/route')
    const res = await GET(req(`/api/games/${g.body.id}`), ctx({ id: g.body.id }))
    const text = await res.text()
    expect(text).not.toContain('8900') // counterpart limit
    expect(text).not.toContain('relocating') // undiscovered fact
    expect(text).not.toContain('privateNotes')
  })

  it('is idempotent: a retried request does not duplicate the turn', async () => {
    const { token } = await signUp('retry@example.com')
    useSession(token)
    const g = await start({ slug: 'buy-used-car' })
    await prep(g.body.id)
    const key = newKey()
    const first = await act(g.body.id, { type: 'MAKE_OFFER', terms: { price: 8600 } }, key)
    const again = await act(g.body.id, { type: 'MAKE_OFFER', terms: { price: 8600 } }, key)
    expect(again.body.turns.length).toBe(first.body.turns.length)
    expect(again.body.offerHistory.length).toBe(first.body.offerHistory.length)
  })

  it('rejects stale versions (optimistic concurrency)', async () => {
    const { token } = await signUp('stale@example.com')
    useSession(token)
    const g = await start({ slug: 'buy-used-car' })
    const v = (await prep(g.body.id)).body.version
    await act(g.body.id, { type: 'ASK', questionKey: 'drive' }, newKey(), v)
    const stale = await act(g.body.id, { type: 'ASK', questionKey: 'inspect' }, newKey(), v)
    expect(stale.status).toBe(409)
  })

  it('blocks access to another user’s game', async () => {
    const a = await signUp('alice@example.com')
    useSession(a.token)
    const g = await start({ slug: 'buy-used-car' })
    const b = await signUp('bob@example.com')
    useSession(b.token)
    const { GET } = await import('@/app/api/games/[id]/route')
    expect((await GET(req(`/api/games/${g.body.id}`), ctx({ id: g.body.id }))).status).toBe(404)
    expect((await act(g.body.id, { type: 'WALK_AWAY' })).status).toBe(404)
    const { GET: result } = await import('@/app/api/games/[id]/result/route')
    expect((await result(req(`/api/games/${g.body.id}/result`), ctx({ id: g.body.id }))).status).toBe(404)
  })

  it('does not let the client decide the outcome or score', async () => {
    const { token } = await signUp('cheat@example.com')
    useSession(token)
    const g = await start({ slug: 'buy-used-car' })
    await prep(g.body.id)
    const { POST } = await import('@/app/api/games/[id]/actions/route')
    const r = await POST(req(`/api/games/${g.body.id}/actions`, { body: { action: { type: 'FORCE_WIN', score: 100 }, idempotencyKey: newKey() } }), ctx({ id: g.body.id }))
    expect(r.status).toBe(400)
  })

  it('enforces the server clock in timed games', async () => {
    const { token } = await signUp('timed@example.com')
    useSession(token)
    const g = await start({ slug: 'ask-for-a-discount', timed: true })
    await prep(g.body.id)
    const { getDb } = await import('@/server/db')
    await (await getDb()).games.updateOne({ _id: g.body.id }, { $set: { deadlineAt: new Date(Date.now() - 1000) } })
    const r = await act(g.body.id, { type: 'ACCEPT' })
    expect(r.body.status).toBe('EXPIRED')
  })

  it('pauses and resumes', async () => {
    const { token } = await signUp('pause@example.com')
    useSession(token)
    const g = await start({ slug: 'buy-used-car' })
    await prep(g.body.id)
    expect((await act(g.body.id, { type: 'PAUSE' })).body.status).toBe('PAUSED')
    expect((await act(g.body.id, { type: 'ASK', questionKey: 'drive' })).status).toBe(409)
    expect((await act(g.body.id, { type: 'RESUME' })).body.status).toBe('ACTIVE')
  })

  it('creates a replay without touching the original', async () => {
    const { token } = await signUp('replay@example.com')
    useSession(token)
    const g = await start({ slug: 'buy-used-car' })
    await prep(g.body.id)
    await act(g.body.id, { type: 'ASK', questionKey: 'drive' })
    const done = await act(g.body.id, { type: 'WALK_AWAY' })
    const { POST } = await import('@/app/api/games/[id]/replay/route')
    const r = await json<{ id: string }>(await POST(req(`/api/games/${g.body.id}/replay`, { body: { snapshot: 1 } }), ctx({ id: g.body.id })))
    expect(r.status).toBe(200)
    const { GET } = await import('@/app/api/games/[id]/route')
    const original = await json<GameView>(await GET(req(`/api/games/${g.body.id}`), ctx({ id: g.body.id })))
    expect(original.body.status).toBe('WALKED_AWAY')
    expect(original.body.turns.length).toBe(done.body.turns.length)
    const replay = await json<GameView>(await GET(req(`/api/games/${r.body.id}`), ctx({ id: r.body.id })))
    expect(replay.body.status).toBe('ACTIVE')
    expect(replay.body.variant).toBe('REPLAY')
  })

  it('locks later challenges until earlier ones are passed', async () => {
    const { token } = await signUp('chal@example.com')
    useSession(token)
    const locked = await start({ slug: 'x-unused', variant: 'CHALLENGE', challengeSlug: 'package-deal' })
    expect(locked.status).toBe(403)
    const open = await start({ slug: 'x-unused', variant: 'CHALLENGE', challengeSlug: 'five-turn-raise' })
    expect(open.status).toBe(200)
  })
})

describe('AI mode', () => {
  it('is unavailable with AI disabled, while Classic still works', async () => {
    await resetAll({ AI_ENABLED: '0' })
    const { token } = await signUp('noai@example.com')
    useSession(token)
    const ai = await start({ slug: 'buy-used-car', mode: 'AI' })
    expect(ai.status).toBe(503)
    expect(ai.body.error?.code).toBe('AI_UNAVAILABLE')
    expect((await start({ slug: 'buy-used-car', mode: 'CLASSIC' })).status).toBe(200)
  })

  it('plays with the mock provider, records usage and blends the evaluation', async () => {
    await resetAll({ AI_ENABLED: '1', AI_PROVIDER: 'mock' })
    const { user, token } = await signUp('ai@example.com')
    useSession(token)
    const g = await start({ slug: 'buy-used-car', mode: 'AI' })
    await prep(g.body.id)
    const m = await act(g.body.id, { type: 'MESSAGE', text: 'I understand you are busy. Why are you selling the car?' })
    expect(m.status).toBe(200)
    const reply = m.body.turns[m.body.turns.length - 1]!
    expect(reply.source).toBe('mock-ai')
    expect(m.body.discovered.map((d) => d.key)).toContain('moving')
    await act(g.body.id, { type: 'MAKE_OFFER', terms: { price: 9000 }, message: 'Because the tyres need work, I can offer 9,000.' })
    const end = await act(g.body.id, { type: 'ACCEPT' })
    expect(end.body.status).toBe('AGREEMENT_REACHED')
    const { getDb } = await import('@/server/db')
    const db = await getDb()
    expect(await db.usage.countDocuments({ userId: user.id, kind: 'AI_TURN' })).toBeGreaterThan(0)
    const ev = await db.evaluations.findOne({ _id: g.body.id })
    expect(ev!.evaluation.aiAssessed).toBe(true)
    expect(ev!.evaluation.dimensions.outcome.source).toBe('rules')
  })

  it('offers a path back to Classic mode', async () => {
    await resetAll({ AI_ENABLED: '1', AI_PROVIDER: 'mock' })
    const { token } = await signUp('switch@example.com')
    useSession(token)
    const g = await start({ slug: 'buy-used-car', mode: 'AI' })
    await prep(g.body.id)
    const { POST } = await import('@/app/api/games/[id]/mode/route')
    const r = await json<GameView>(await POST(req(`/api/games/${g.body.id}/mode`, { body: { mode: 'CLASSIC' } }), ctx({ id: g.body.id })))
    expect(r.body.mode).toBe('CLASSIC')
    expect(r.body.questions.length).toBeGreaterThan(0)
  })
})
