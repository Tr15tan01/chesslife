import { z } from 'zod'
import { route, readJson, Errors } from '@/server/http'
import { verifyEmail } from '@/server/services/accounts'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route({}, async ({ req, ip }) => {
  await enforce(RULES.account, ip)
  const { token } = await readJson(req, z.object({ token: z.string().min(20).max(100) }))
  const user = await verifyEmail(token)
  if (!user) throw Errors.invalid('This confirmation link is invalid or has expired.')
  return { ok: true }
})
