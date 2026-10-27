import { z } from 'zod'
import { route, readJson } from '@/server/http'
import { getDb } from '@/server/db'

export const PATCH = route({ auth: true }, async ({ req, user }) => {
  const { name } = await readJson(req, z.object({ name: z.string().trim().min(1, 'Enter your name.').max(80) }))
  await (await getDb()).users.updateOne({ _id: user!.id }, { $set: { name, updatedAt: new Date() } })
  return { ok: true }
})
