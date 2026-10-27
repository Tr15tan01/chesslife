import { route } from '@/server/http'
import { getDashboard } from '@/server/services/analytics'

export const GET = route({ auth: true }, async ({ user }) => getDashboard(user!.id))
