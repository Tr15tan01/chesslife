import { route } from '@/server/http'
import { listUsers, userQuerySchema } from '@/server/services/admin'

export const GET = route({ permission: 'admin:users' }, async ({ req, user }) => listUsers(user!, userQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))))
