import { z } from 'zod'
import { route, readJson } from '@/server/http'
import { resetPassword } from '@/server/services/accounts'
import { startSession } from '@/server/auth/session'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route({}, async ({ req, ip }) => {
  await enforce(RULES.reset, ip)
  const { token, password } = await readJson(req, z.object({ token: z.string().min(20).max(100), password: z.string().max(128) }))
  const user = await resetPassword(token, password)
  await startSession(user)
  return { ok: true }
})
