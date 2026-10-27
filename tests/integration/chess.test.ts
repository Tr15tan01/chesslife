import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, json, newKey, req, resetAll, signUp, useSession } from './harness'
import { Chess, type Move } from 'chess.js'
import type { ChessView } from '@/lib/chess/types'

type Err = { error?: { code: string; message: string } }

async function start(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/chess/route')
  return json<{ id: string } & Err>(await POST(req('/api/chess', { body }), ctx()))
}
async function act(id: string, action: Record<string, unknown>, key = newKey()) {
  const { POST } = await import('@/app/api/chess/[id]/actions/route')
  return json<ChessView & Err>(await POST(req(`/api/chess/${id}/actions`, { body: { action, idempotencyKey: key } }), ctx({ id })))
}
async function view(id: string) {
  const { GET } = await import('@/app/api/chess/[id]/route')
  return json<ChessView & Err>(await GET(req(`/api/chess/${id}`), ctx({ id })))
}
async function mode(id: string, m: 'AI' | 'CLASSIC') {
  const { POST } = await import('@/app/api/chess/[id]/mode/route')
  return json<ChessView & Err>(await POST(req(`/api/chess/${id}/mode`, { body: { mode: m } }), ctx({ id })))
}

describe('Life Chess through the API', () => {
  beforeEach(() => resetAll())

  it('plays moves against the bot, opens a life scene and records the choice', async () => {
    const { token } = await signUp('chess@example.com')
    useSession(token)
    const g = await start({ opponent: 'sam', color: 'w' })
    expect(g.status).toBe(200)

    const bad = await act(g.body.id, { type: 'MOVE', from: 'e2', to: 'e5' })
    expect(bad.status).toBe(400)

    const key = newKey()
    const m1 = await act(g.body.id, { type: 'MOVE', from: 'e2', to: 'e4' }, key)
    expect(m1.status).toBe(200)
    expect(m1.body.moves).toHaveLength(2)
    expect(m1.body.moves[1]!.color).toBe('b')
    expect(m1.body.comments.at(-1)?.source).toBe('rules')
    const scene = m1.body.scenes[0]!
    expect(scene.kind).toBe('OPENING')
    expect(scene.chosen).toBeNull()
    // Outcomes are not sent before the player chooses.
    expect(JSON.stringify(scene)).not.toContain('outcome')

    // Replaying the same idempotency key does not move twice.
    const replay = await act(g.body.id, { type: 'MOVE', from: 'e2', to: 'e4' }, key)
    expect(replay.body.moves).toHaveLength(2)

    const chosen = await act(g.body.id, { type: 'CHOOSE', sceneId: scene.id, optionKey: scene.options[0]!.key })
    expect(chosen.body.scenes[0]!.chosen?.outcome).toBeTruthy()
    expect(chosen.body.lifeScore.answered).toBe(1)
    const again = await act(g.body.id, { type: 'CHOOSE', sceneId: scene.id, optionKey: scene.options[1]!.key })
    expect(again.status).toBe(409)

    const resigned = await act(g.body.id, { type: 'RESIGN' })
    expect(resigned.body.status).toBe('LOST')
    expect(resigned.body.endReason).toBe('RESIGNATION')
    expect(resigned.body.scenes.at(-1)?.kind).toBe('LOSE')
    expect((await act(g.body.id, { type: 'MOVE', from: 'd2', to: 'd4' })).status).toBe(409)
  })

  it('lets the bot open when the player is black, and keeps games private', async () => {
    const a = await signUp('a@example.com')
    useSession(a.token)
    const g = await start({ opponent: 'dana', color: 'b' })
    const v = await view(g.body.id)
    expect(v.body.playerColor).toBe('b')
    expect(v.body.moves).toHaveLength(1)

    const b = await signUp('b@example.com')
    useSession(b.token)
    expect((await view(g.body.id)).status).toBe(404)
    expect((await act(g.body.id, { type: 'RESIGN' })).status).toBe(404)
  })

  it('refuses AI mode when AI is off', async () => {
    const { token } = await signUp('classic@example.com')
    useSession(token)
    expect((await start({ opponent: 'sam', mode: 'AI' })).status).toBe(503)
    const g = await start({ opponent: 'sam' })
    expect((await mode(g.body.id, 'AI')).status).toBe(503)
  })

  it('negotiates a takeback and rewinds the board', async () => {
    const { token } = await signUp('takeback@example.com')
    useSession(token)
    const g = await start({ opponent: 'dana', color: 'w' })
    const m1 = await act(g.body.id, { type: 'MOVE', from: 'e2', to: 'e4' })
    expect(m1.body.can.takeback).toBe(true)
    const fenBefore = new Chess().fen()

    const open = await act(g.body.id, { type: 'DEAL_REQUEST', kind: 'TAKEBACK' })
    expect(open.body.deal).toMatchObject({ kind: 'TAKEBACK', by: 'player', counterOffer: { pawns: 2 } })
    // The engine's hidden limits never reach the browser.
    expect(JSON.stringify(open.body.deal)).not.toMatch(/limit|firmness|floor/)
    expect((await act(g.body.id, { type: 'MOVE', from: 'd2', to: 'd4' })).status).toBe(409)

    const low = await act(g.body.id, { type: 'DEAL', action: { type: 'MAKE_OFFER', terms: { pawns: 0 } } })
    expect(low.status).toBe(200)
    const done = low.body.deal ? await act(g.body.id, { type: 'DEAL', action: { type: 'ACCEPT' } }) : low
    expect(done.body.deal).toBeNull()
    const record = done.body.deals[0]!
    expect(record.outcome).toBe('AGREED')
    expect(done.body.moves.map((m) => m.undone)).toEqual([true, true])
    const paid = done.body.edits[0]!.remove.length
    const board = new Chess(done.body.fen)
    expect(board.turn()).toBe('w')
    expect(board.findPiece({ type: 'p', color: 'w' })).toHaveLength(8 - paid)
    expect(new Chess(fenBefore).findPiece({ type: 'p', color: 'b' })).toHaveLength(board.findPiece({ type: 'p', color: 'b' }).length)
    expect(done.body.can.takeback).toBe(false)
    expect(done.body.comments.at(-1)?.text).not.toMatch(/no deal/i)

    const next = await act(g.body.id, { type: 'MOVE', from: 'd2', to: 'd4' })
    expect(next.status).toBe(200)
    expect(next.body.moves).toHaveLength(4)
  })

  it('walking away from a deal leaves the board unchanged', async () => {
    const { token } = await signUp('walk@example.com')
    useSession(token)
    const g = await start({ opponent: 'victor', color: 'w' })
    const m1 = await act(g.body.id, { type: 'MOVE', from: 'g1', to: 'f3' })
    await act(g.body.id, { type: 'DEAL_REQUEST', kind: 'TAKEBACK' })
    const walked = await act(g.body.id, { type: 'DEAL', action: { type: 'WALK_AWAY' } })
    expect(walked.body.deal).toBeNull()
    expect(walked.body.deals[0]).toMatchObject({ kind: 'TAKEBACK', outcome: 'DECLINED' })
    expect(walked.body.fen).toBe(m1.body.fen)
    expect(walked.body.edits).toHaveLength(0)
  })

  it('judges draw offers with the bot and limits how often they are made', async () => {
    const { token } = await signUp('draw@example.com')
    useSession(token)
    let id = ''
    let v: ChessView | null = null
    // Play ten quiet moves (closing any deal the opponent proposes); retry if the game ends early.
    for (let attempt = 0; attempt < 4 && !v?.can.draw; attempt++) {
      id = (await start({ opponent: 'sam', color: 'w' })).body.id
      v = (await view(id)).body
      for (let t = 0; t < 30 && v.status === 'ACTIVE' && !v.can.draw; t++) {
        if (v.deal) {
          v = (await act(id, { type: 'DEAL', action: { type: 'WALK_AWAY' } })).body
          continue
        }
        const ms: Move[] = new Chess(v.fen).moves({ verbose: true })
        const quiet: Move[] = ms.filter((x) => !x.captured && x.piece !== 'q')
        const m: Move = (quiet.length ? quiet : ms)[t % (quiet.length || ms.length)]!
        v = (await act(id, { type: 'MOVE', from: m.from, to: m.to, promotion: m.promotion })).body
      }
    }
    expect(v?.can.draw).toBe(true)
    const offer = await act(id, { type: 'DEAL_REQUEST', kind: 'DRAW' })
    const record = offer.body.deals.at(-1)!
    expect(record.kind).toBe('DRAW')
    if (record.outcome === 'AGREED') {
      expect(offer.body).toMatchObject({ status: 'DRAWN', endReason: 'AGREEMENT' })
      expect(offer.body.scenes.at(-1)?.kind).toBe('DRAW')
    } else {
      expect(offer.body.status).toBe('ACTIVE')
      expect(offer.body.can.draw).toBe(false)
      expect((await act(id, { type: 'DEAL_REQUEST', kind: 'DRAW' })).status).toBe(409)
    }
  })

  it('the opponent puts deals on the table: takebacks after blunders, queen trades when ahead', async () => {
    const { token } = await signUp('offers@example.com')
    useSession(token)
    /** Loose play that keeps the queen home: pieces hang, so the bot gets ahead or punishes a blunder. */
    async function playUntilOffer(opponent: string, kind: string) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const id = (await start({ opponent, color: 'w' })).body.id
        let v = (await view(id)).body
        for (let t = 0; t < 40 && v.status === 'ACTIVE'; t++) {
          if (v.deal?.by === 'opponent' && v.deal.kind === kind) return { id, v }
          if (v.deal) {
            v = (await act(id, { type: 'DEAL', action: { type: 'WALK_AWAY' } })).body
            continue
          }
          const ms = new Chess(v.fen).moves({ verbose: true }).filter((m) => m.piece !== 'q' && m.piece !== 'k')
          if (!ms.length) break
          const m = ms[(t * 5 + attempt) % ms.length]!
          v = (await act(id, { type: 'MOVE', from: m.from, to: m.to, promotion: m.promotion })).body
        }
      }
      return null
    }

    const trade = await playUntilOffer('victor', 'QUEEN_TRADE')
    expect(trade).not.toBeNull()
    expect(trade!.v.deal?.counterOffer).toEqual({ pawns: 0 })
    const agreed = await act(trade!.id, { type: 'DEAL', action: { type: 'ACCEPT' } })
    expect(agreed.body.deals.at(-1)).toMatchObject({ kind: 'QUEEN_TRADE', outcome: 'AGREED' })
    expect(new Chess(agreed.body.fen).findPiece({ type: 'q', color: 'w' })).toHaveLength(0)
    expect(new Chess(agreed.body.fen).findPiece({ type: 'q', color: 'b' })).toHaveLength(0)

    const takeback = await playUntilOffer('dana', 'TAKEBACK')
    expect(takeback).not.toBeNull()
    const n = takeback!.v.moves.length
    const yes = await act(takeback!.id, { type: 'DEAL', action: { type: 'ACCEPT' } })
    expect(yes.body.moves.slice(n - 2).every((m) => m.undone)).toBe(true)
    // Victor thinks for up to a second per move.
  }, 180_000)

  it('words deal replies with the mock AI provider', async () => {
    await resetAll({ AI_ENABLED: '1', AI_PROVIDER: 'mock' })
    const { token } = await signUp('aideal@example.com')
    useSession(token)
    const g = await start({ opponent: 'sam', mode: 'AI' })
    await act(g.body.id, { type: 'MOVE', from: 'e2', to: 'e4' })
    await act(g.body.id, { type: 'DEAL_REQUEST', kind: 'TAKEBACK' })
    const r = await act(g.body.id, { type: 'DEAL', action: { type: 'MESSAGE', text: 'I understand, that was my mistake. Why let me take it back?' } })
    expect(r.status).toBe(200)
    expect(r.body.deal?.turns.at(-1)?.source).toBe('mock-ai')
  })

  it('narrates with the mock AI provider and can switch back to Classic', async () => {
    await resetAll({ AI_ENABLED: '1', AI_PROVIDER: 'mock' })
    const { token } = await signUp('ai@example.com')
    useSession(token)
    const g = await start({ opponent: 'victor', mode: 'AI' })
    const m = await act(g.body.id, { type: 'MOVE', from: 'd2', to: 'd4' })
    expect(m.status).toBe(200)
    expect(m.body.comments.at(-1)?.source).toBe('mock-ai')
    expect(m.body.scenes[0]?.source).toBe('mock-ai')
    const c = await mode(g.body.id, 'CLASSIC')
    expect(c.body.mode).toBe('CLASSIC')
    const m2 = await act(g.body.id, { type: 'MOVE', from: 'c2', to: 'c4' })
    expect(m2.body.comments.at(-1)?.source).toBe('rules')
  })
})
