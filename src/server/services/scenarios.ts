import 'server-only'
import { z } from 'zod'
import { CATEGORIES, type Category, type ScenarioPublic } from '@/lib/negotiation/types'
import { getDb } from '../db'
import type { ScenarioDoc, ScenarioVersionDoc } from '../db/models'
import { Errors } from '../http'
import type { ScenarioContext } from '../engine/utility'

/** Public catalog card: safe for any visitor. */
export type ScenarioCard = Pick<
  ScenarioDoc,
  'slug' | 'title' | 'summary' | 'category' | 'difficulty' | 'tags' | 'quick' | 'estMinutes' | 'learningObjective' | 'counterpartName' | 'counterpartRole' | 'counterpartStyle' | 'issueLabels'
> & { custom: boolean }

const CARD_PROJECTION = {
  _id: 0,
  slug: 1,
  title: 1,
  summary: 1,
  category: 1,
  difficulty: 1,
  tags: 1,
  quick: 1,
  estMinutes: 1,
  learningObjective: 1,
  counterpartName: 1,
  counterpartRole: 1,
  counterpartStyle: 1,
  issueLabels: 1,
  ownerId: 1,
} as const

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.enum(CATEGORIES).optional(),
  difficulty: z.coerce.number().int().min(1).max(4).optional(),
  quick: z.enum(['1']).optional(),
})

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function listScenarios(query: z.infer<typeof catalogQuerySchema>, viewerId: string | null = null): Promise<ScenarioCard[]> {
  const db = await getDb()
  const visibility = viewerId ? { $or: [{ visibility: 'PUBLIC', published: true }, { ownerId: viewerId }] } : { visibility: 'PUBLIC', published: true }
  const filter: Record<string, unknown> = { ...visibility }
  if (query.category) filter.category = query.category
  if (query.difficulty) filter.difficulty = query.difficulty
  if (query.quick) filter.quick = true
  if (query.q) {
    const rx = { $regex: escapeRegex(query.q), $options: 'i' }
    filter.$and = [{ $or: [{ title: rx }, { summary: rx }, { tags: rx }] }]
  }
  const docs = await db.scenarios.find(filter as never, { sort: { difficulty: 1, title: 1 }, limit: 200, projection: CARD_PROJECTION })
  return docs.map(({ ownerId, ...d }) => ({ ...(d as unknown as Omit<ScenarioCard, 'custom'>), custom: Boolean(ownerId) }))
}

/** Public detail view: only the public half of the current version. */
export async function getScenarioPublic(slug: string, viewerId: string | null = null): Promise<{ doc: ScenarioDoc; pub: ScenarioPublic } | null> {
  const db = await getDb()
  const doc = await db.scenarios.findOne({ slug })
  if (!doc) return null
  const visible = (doc.visibility === 'PUBLIC' && doc.published) || (viewerId && doc.ownerId === viewerId)
  if (!visible) return null
  const ver = await db.scenarioVersions.findOne({ scenarioId: doc._id, version: doc.currentVersion }, { projection: { public: 1 } })
  if (!ver) return null
  return { doc, pub: ver.public }
}

/** Server-only: full context including hidden configuration. */
export async function loadScenarioContext(scenarioId: string, version: number): Promise<ScenarioContext> {
  const db = await getDb()
  const ver = await db.scenarioVersions.findOne({ scenarioId, version })
  if (!ver) throw Errors.notFound('Scenario version')
  return { pub: ver.public, priv: ver.private }
}

export async function loadPlayableScenario(slug: string, userId: string): Promise<{ doc: ScenarioDoc; ver: ScenarioVersionDoc }> {
  const db = await getDb()
  const doc = await db.scenarios.findOne({ slug })
  if (!doc) throw Errors.notFound('Scenario')
  const visible = (doc.visibility === 'PUBLIC' && doc.published) || doc.ownerId === userId
  if (!visible) throw Errors.notFound('Scenario')
  const ver = await db.scenarioVersions.findOne({ scenarioId: doc._id, version: doc.currentVersion })
  if (!ver) throw Errors.notFound('Scenario')
  return { doc, ver }
}

export async function categoryCounts(): Promise<Record<Category, number>> {
  const db = await getDb()
  const rows = await db.scenarios.aggregate<{ _id: Category; n: number }>([
    { $match: { visibility: 'PUBLIC', published: true } },
    { $group: { _id: '$category', n: { $sum: 1 } } },
  ])
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  for (const r of rows) out[r._id] = r.n
  return out
}
