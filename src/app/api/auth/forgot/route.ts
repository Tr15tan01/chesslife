import { z } from 'zod'
import { route, readJson } from '@/server/http'
import { requestPasswordReset } from '@/server/services/accounts'
import { emailSchema } from '@/server/security/password'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route({}, async ({ req, ip }) => {
  const { email } = await readJson(req, z.object({ email: emailSchema }))
  await enforce(RULES.reset, ip)
  await enforce(RULES.reset, `email:${email}`)
  const r = await requestPasswordReset(email)
  return { ok: true, emailAvailable: r.emailAvailable }
})
