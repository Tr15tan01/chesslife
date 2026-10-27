import { z } from 'zod'
import { DIMENSIONS } from '@/lib/negotiation/types'
import { route, readJson } from '@/server/http'
import { getDb } from '@/server/db'

const schema = z.object({
  theme: z.enum(['dark', 'light']).optional(),
  focusSkills: z.array(z.enum(DIMENSIONS)).max(3).optional(),
  defaultMode: z.enum(['CLASSIC', 'AI']).optional(),
  timedByDefault: z.boolean().optional(),
  showRapport: z.boolean().optional(),
})

export const PATCH = route({ auth: true }, async ({ req, user }) => {
  const patch = await readJson(req, schema)
  const db = await getDb()
  // Explicit field list: no mass assignment.
  const set: Record<string, unknown> = { updatedAt: new Date() }
  for (const k of ['theme', 'focusSkills', 'defaultMode', 'timedByDefault', 'showRapport'] as const) if (patch[k] !== undefined) set[k] = patch[k]
  const defaults: Record<string, unknown> = { theme: 'dark', focusSkills: [], defaultMode: 'CLASSIC', timedByDefault: false, showRapport: true }
  for (const k of Object.keys(set)) delete defaults[k]
  await db.preferences.updateOne({ _id: user!.id }, { $set: set, $setOnInsert: defaults } as never, { upsert: true })
  return { ok: true }
})
