import { z } from 'zod'
import { route, readJson, Errors } from '@/server/http'
import { previewMove } from '@/server/services/showcase'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route({}, async ({ req, ip }) => {
  await enforce(RULES.turn, `preview:${ip}`)
  const { move } = await readJson(req, z.object({ move: z.enum(['why', 'anchor', 'best']) }))
  const r = await previewMove(move)
  if (!r) throw Errors.notFound('Preview')
  return r
})
