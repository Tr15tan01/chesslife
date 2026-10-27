import { route, Errors } from '@/server/http'
import { getGameView } from '@/server/services/games'
import { getEvaluation } from '@/server/services/completion'

export const GET = route<{ id: string }>({ auth: true }, async ({ user, params }) => {
  const game = await getGameView(user!, params.id)
  const evaluation = await getEvaluation(user!.id, params.id)
  if (!evaluation) throw Errors.notFound('Result')
  return { game, evaluation }
})
