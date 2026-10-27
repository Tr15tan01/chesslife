import { route } from '@/server/http'
import { historyQuerySchema, listHistory } from '@/server/services/games'

export const GET = route({ auth: true }, async ({ req, user }) => listHistory(user!.id, historyQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))))
