import { route, readJson } from '@/server/http'
import { startGame, startSchema } from '@/server/services/games'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route({ auth: true }, async ({ req, user }) => {
  await enforce(RULES.start, user!.id)
  const input = await readJson(req, startSchema)
  return startGame(user!, input)
})
