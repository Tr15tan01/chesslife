import { route, readJson } from '@/server/http'
import { actionRequestSchema, submitAction } from '@/server/services/games'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route<{ id: string }>({ auth: true }, async ({ req, user, params }) => {
  const body = await readJson(req, actionRequestSchema)
  await enforce(RULES.turn, user!.id)
  return submitAction(user!, params.id, body)
})
