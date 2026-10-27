import { route } from '@/server/http'
import { getChessView } from '@/server/services/chess'

export const GET = route<{ id: string }>({ auth: true }, async ({ user, params }) => getChessView(user!, params.id))
