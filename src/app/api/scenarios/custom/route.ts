import { route, readJson } from '@/server/http'
import { createCustomScenario, customScenarioSchema } from '@/server/services/custom'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route({ auth: true }, async ({ req, user }) => {
  await enforce(RULES.start, user!.id)
  const input = await readJson(req, customScenarioSchema)
  return createCustomScenario(user!, input)
})
