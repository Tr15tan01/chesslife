import { route, readJson } from '@/server/http'
import { chessActionRequestSchema, submitChessAction } from '@/server/services/chess'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route<{ id: string }>({ auth: true }, async ({ req, user, params }) => {
  const body = await readJson(req, chessActionRequestSchema)
  await enforce(RULES.turn, user!.id)
  return submitChessAction(user!, params.id, body)
})
