import { z } from 'zod'
import { route, readJson } from '@/server/http'
import { switchToClassic } from '@/server/services/games'

export const POST = route<{ id: string }>({ auth: true }, async ({ req, user, params }) => {
  await readJson(req, z.object({ mode: z.literal('CLASSIC') }))
  return switchToClassic(user!, params.id)
})
