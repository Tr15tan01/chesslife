import { z } from 'zod'
import { route, readJson } from '@/server/http'
import { createReplay } from '@/server/services/games'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route<{ id: string }>({ auth: true }, async ({ req, user, params }) => {
  await enforce(RULES.start, user!.id)
  const { snapshot } = await readJson(req, z.object({ snapshot: z.number().int().min(0).max(200) }))
  return createReplay(user!, params.id, snapshot)
})
