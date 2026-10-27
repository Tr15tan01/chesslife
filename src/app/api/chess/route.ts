import { route, readJson } from '@/server/http'
import { chessStartSchema, startChess } from '@/server/services/chess'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route({ auth: true }, async ({ req, user }) => {
  await enforce(RULES.start, user!.id)
  const input = await readJson(req, chessStartSchema)
  return startChess(user!, input)
})
