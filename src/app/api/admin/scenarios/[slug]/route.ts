import { route, readJson } from '@/server/http'
import { scenarioUpdateSchema, updateScenario } from '@/server/services/admin'
import { enforce, RULES } from '@/server/security/rate-limit'

export const PATCH = route<{ slug: string }>({ permission: 'content:manage' }, async ({ req, user, params }) => {
  await enforce(RULES.admin, user!.id)
  return updateScenario(user!, params.slug, await readJson(req, scenarioUpdateSchema))
})
