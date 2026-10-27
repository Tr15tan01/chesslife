import { route } from '@/server/http'
import { getGameView } from '@/server/services/games'

export const GET = route<{ id: string }>({ auth: true }, async ({ user, params }) => getGameView(user!, params.id))
