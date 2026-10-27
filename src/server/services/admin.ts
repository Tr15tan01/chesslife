import 'server-only'
import { z } from 'zod'
import { DIMENSIONS, type Dimension } from '@/lib/negotiation/types'
import { getDb } from '../db'
import type { Role, UserStatus } from '../db/models'
import type { SessionUser } from '../auth/session'
import { can } from '../auth/permissions'
import { Errors } from '../http'
import { audit } from './logging'
import { FLAG_DEFS, getFlags, type FlagKey } from './flags'
import { validateScenario } from '../content/validate'

/**
 * Administrative operations. Every mutation re-checks the actor's
 * permission server-side and writes an audit log entry. Conversation
 * transcripts are intentionally not exposed to administrators.
 */

function assertCan(actor: SessionUser, p: Parameters<typeof can>[1]) {
  if (!can(actor.role, p)) throw Errors.forbidden()
}

export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  q: z.string().trim().max(80).optional(),
  role: z.enum(['USER', 'ADMIN', 'CONTENT_MANAGER']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
})

export async function listUsers(actor: SessionUser, q: z.infer<typeof userQuerySchema>) {
  assertCan(actor, 'admin:users')
  const db = await getDb()
  const filter: Record<string, unknown> = {}
  if (q.role) filter.role = q.role
  if (q.status) filter.status = q.status
  if (q.q) filter.$or = [{ email: { $regex: q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, { name: { $regex: q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }]
  const pageSize = 20
  const [users, total] = await Promise.all([
    db.users.find(filter as never, { sort: { createdAt: -1 }, skip: (q.page - 1) * pageSize, limit: pageSize, projection: { passwordHash: 0, authVersion: 0 } }),
    db.users.countDocuments(filter as never),
  ])
  const ids = users.map((u) => u._id)
  const games = await db.games.aggregate<{ _id: string; n: number }>([{ $match: { userId: { $in: ids } } }, { $group: { _id: '$userId', n: { $sum: 1 } } }])
  return {
    users: users.map((u) => ({
      id: u._id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      plan: u.plan,
      verified: Boolean(u.emailVerified),
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      games: games.find((g) => g._id === u._id)?.n ?? 0,
    })),
    total,
    pageSize,
  }
}

export const roleSchema = z.object({ role: z.enum(['USER', 'ADMIN', 'CONTENT_MANAGER']) })
export const statusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) })

export async function setUserRole(actor: SessionUser, userId: string, role: Role) {
  assertCan(actor, 'admin:roles')
  if (userId === actor.id) throw Errors.invalid('You cannot change your own role.')
  const db = await getDb()
  const user = await db.users.findOne({ _id: userId })
  if (!user) throw Errors.notFound('User')
  if (user.role === role) return { ok: true }
  // Role changes rotate the target's sessions.
  await db.users.updateOne({ _id: userId }, { $set: { role, updatedAt: new Date() }, $inc: { authVersion: 1 } })
  await db.sessions.deleteMany({ userId })
  await audit({ id: actor.id, email: actor.email }, 'user.role_changed', 'user', userId, { from: user.role, to: role })
  return { ok: true }
}

export async function setUserStatus(actor: SessionUser, userId: string, status: UserStatus) {
  assertCan(actor, 'admin:users')
  if (userId === actor.id) throw Errors.invalid('You cannot suspend your own account.')
  const db = await getDb()
  const user = await db.users.findOne({ _id: userId })
  if (!user) throw Errors.notFound('User')
  await db.users.updateOne({ _id: userId }, { $set: { status, updatedAt: new Date() } })
  if (status === 'SUSPENDED') await db.sessions.deleteMany({ userId })
  await audit({ id: actor.id, email: actor.email }, status === 'SUSPENDED' ? 'user.suspended' : 'user.reactivated', 'user', userId)
  return { ok: true }
}

export async function getStats(actor: SessionUser) {
  assertCan(actor, 'admin:view')
  const db = await getDb()
  const since30 = new Date(Date.now() - 30 * 86400000)
  const since7 = new Date(Date.now() - 7 * 86400000)
  const [users, newUsers, games, completed7, aiUsage, scenarios, byMode] = await Promise.all([
    db.users.countDocuments({}),
    db.users.countDocuments({ createdAt: { $gte: since7 } } as never),
    db.games.countDocuments({}),
    db.games.countDocuments({ completedAt: { $gte: since7 } } as never),
    can(actor.role, 'admin:usage')
      ? db.usage.aggregate<{ _id: string; calls: number; failures: number; input: number; output: number; cost: number }>([
          { $match: { createdAt: { $gte: since30 } } },
          { $group: { _id: '$day', calls: { $sum: 1 }, failures: { $sum: { $cond: ['$ok', 0, 1] } }, input: { $sum: '$inputTokens' }, output: { $sum: '$outputTokens' }, cost: { $sum: '$costMicros' } } },
          { $sort: { _id: 1 } },
        ])
      : Promise.resolve([]),
    db.scenarios.countDocuments({ visibility: 'PUBLIC' }),
    db.games.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$mode', n: { $sum: 1 } } }]),
  ])
  return { users, newUsers, games, completed7, scenarios, aiUsage, byMode }
}

export async function listAdminScenarios(actor: SessionUser) {
  assertCan(actor, 'content:manage')
  const db = await getDb()
  const docs = await db.scenarios.find({ visibility: 'PUBLIC' }, { sort: { category: 1, difficulty: 1 } })
  return docs.map((d) => ({ id: d._id, slug: d.slug, title: d.title, summary: d.summary, category: d.category, difficulty: d.difficulty, published: d.published, version: d.currentVersion, tags: d.tags, updatedAt: d.updatedAt.toISOString() }))
}

export async function getAdminScenario(actor: SessionUser, slug: string) {
  assertCan(actor, 'content:manage')
  const db = await getDb()
  const doc = await db.scenarios.findOne({ slug, visibility: 'PUBLIC' })
  if (!doc) throw Errors.notFound('Scenario')
  const ver = await db.scenarioVersions.findOne({ scenarioId: doc._id, version: doc.currentVersion })
  return { doc, weights: ver!.private.rubric.weights, pub: ver!.public }
}

export const scenarioUpdateSchema = z.object({
  title: z.string().trim().min(3).max(100).optional(),
  summary: z.string().trim().min(10).max(240).optional(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).optional(),
  published: z.boolean().optional(),
  weights: z.record(z.enum(DIMENSIONS), z.number().min(0.5).max(5)).optional(),
})

/** Metadata or scoring changes create a new immutable version. */
export async function updateScenario(actor: SessionUser, slug: string, patch: z.infer<typeof scenarioUpdateSchema>) {
  assertCan(actor, 'content:manage')
  const db = await getDb()
  const doc = await db.scenarios.findOne({ slug, visibility: 'PUBLIC' })
  if (!doc) throw Errors.notFound('Scenario')
  const now = new Date()
  const contentChange = patch.title || patch.summary || patch.difficulty || patch.tags || patch.weights
  let version = doc.currentVersion
  if (contentChange) {
    const ver = await db.scenarioVersions.findOne({ scenarioId: doc._id, version: doc.currentVersion })
    if (!ver) throw Errors.notFound('Scenario version')
    const pub = { ...ver.public, title: patch.title ?? ver.public.title, summary: patch.summary ?? ver.public.summary, difficulty: patch.difficulty ?? ver.public.difficulty, tags: patch.tags ?? ver.public.tags }
    const priv = structuredClone(ver.private)
    if (patch.weights) priv.rubric.weights = { ...priv.rubric.weights, ...patch.weights } as Record<Dimension, number>
    const errors = validateScenario({ pub, priv, focus: [] })
    if (errors.length) throw Errors.invalid(errors[0]!)
    version = doc.currentVersion + 1
    await db.scenarioVersions.insertOne({ _id: crypto.randomUUID(), scenarioId: doc._id, version, public: pub, private: priv, createdAt: now, createdBy: actor.id })
    const focus = (Object.entries(priv.rubric.weights) as [Dimension, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => d)
    await db.scenarios.updateOne({ _id: doc._id }, { $set: { title: pub.title, summary: pub.summary, difficulty: pub.difficulty, tags: pub.tags, focus, currentVersion: version, updatedAt: now } })
  }
  if (patch.published !== undefined) await db.scenarios.updateOne({ _id: doc._id }, { $set: { published: patch.published, updatedAt: now } })
  await audit({ id: actor.id, email: actor.email }, 'scenario.updated', 'scenario', doc._id, { slug, fields: Object.keys(patch), version })
  return { ok: true, version }
}

export async function listAdminPrograms(actor: SessionUser) {
  assertCan(actor, 'content:manage')
  const db = await getDb()
  const [programs, lessons] = await Promise.all([db.programs.find({}, { sort: { order: 1 } }), db.lessons.find({}, { sort: { order: 1 } })])
  return programs.map((p) => ({ id: p._id, slug: p.slug, title: p.title, published: p.published, lessons: lessons.filter((l) => l.programId === p._id).map((l) => ({ id: l._id, slug: l.slug, title: l.title, published: l.published })) }))
}

export async function setPublished(actor: SessionUser, kind: 'program' | 'lesson', slug: string, published: boolean) {
  assertCan(actor, 'content:manage')
  const db = await getDb()
  const col = kind === 'program' ? db.programs : db.lessons
  const r = await col.updateOne({ slug }, { $set: { published, updatedAt: new Date() } })
  if (!r.matched) throw Errors.notFound(kind === 'program' ? 'Programme' : 'Lesson')
  await audit({ id: actor.id, email: actor.email }, `${kind}.${published ? 'published' : 'unpublished'}`, kind, slug)
  return { ok: true }
}

export const flagSchema = z.object({ key: z.enum(Object.keys(FLAG_DEFS) as [FlagKey, ...FlagKey[]]), enabled: z.boolean(), value: z.number().int().min(0).max(10000).optional() })

export async function setFlag(actor: SessionUser, input: z.infer<typeof flagSchema>) {
  assertCan(actor, 'admin:flags')
  const db = await getDb()
  await db.flags.updateOne({ _id: input.key }, { $set: { enabled: input.enabled, value: input.value, updatedAt: new Date(), updatedBy: actor.id } }, { upsert: true })
  await audit({ id: actor.id, email: actor.email }, 'flag.updated', 'flag', input.key, { enabled: input.enabled, value: input.value })
  return getFlags()
}

export async function listAudit(actor: SessionUser, page: number) {
  assertCan(actor, 'admin:audit')
  const db = await getDb()
  const pageSize = 30
  const [rows, total] = await Promise.all([db.audit.find({}, { sort: { createdAt: -1 }, skip: (page - 1) * pageSize, limit: pageSize }), db.audit.countDocuments({})])
  return { rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })), total, pageSize }
}

export async function listErrors(actor: SessionUser) {
  assertCan(actor, 'admin:errors')
  const db = await getDb()
  const rows = await db.errors.find({}, { sort: { createdAt: -1 }, limit: 50 })
  return rows.map((r) => ({ id: r._id, scope: r.scope, message: r.message, createdAt: r.createdAt.toISOString() }))
}
