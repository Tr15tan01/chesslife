import { route, Errors } from '@/server/http'
import { catalogQuerySchema, listScenarios } from '@/server/services/scenarios'

export const GET = route({}, async ({ req, user }) => {
  const q = catalogQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!q.success) throw Errors.invalid('Invalid filters.')
  return { scenarios: await listScenarios(q.data, user?.id ?? null) }
})
