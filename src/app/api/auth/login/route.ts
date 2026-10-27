import { route, readJson } from '@/server/http'
import { authenticate, loginSchema } from '@/server/services/accounts'
import { startSession } from '@/server/auth/session'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route({}, async ({ req, ip }) => {
  const input = await readJson(req, loginSchema)
  await enforce(RULES.login, ip)
  await enforce(RULES.login, `email:${input.email}`)
  const user = await authenticate(input)
  await startSession(user)
  return { ok: true }
})
