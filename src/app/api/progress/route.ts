import { route, Errors } from '@/server/http'
import { getProgress, progressQuerySchema } from '@/server/services/analytics'

export const GET = route({ auth: true }, async ({ req, user }) => {
  const q = progressQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!q.success) throw Errors.invalid('Invalid filters.')
  return getProgress(user!.id, q.data)
})
