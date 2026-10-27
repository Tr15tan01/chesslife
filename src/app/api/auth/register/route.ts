import { route } from '@/server/http'
import { readJson, AppError } from '@/server/http'
import { register, registerSchema } from '@/server/services/accounts'
import { startSession } from '@/server/auth/session'
import { enforce, RULES } from '@/server/security/rate-limit'
import { getFlags } from '@/server/services/flags'

export const POST = route({}, async ({ req, ip }) => {
  await enforce(RULES.register, ip)
  if (!(await getFlags()).registration.enabled) throw new AppError(503, 'DISABLED', 'Registration is temporarily closed.')
  const input = await readJson(req, registerSchema)
  const res = await register(input)
  if (res.user) await startSession(res.user)
  // Same response shape whether or not the email already existed.
  return { ok: true, signedIn: Boolean(res.user), verificationSent: res.verificationSent }
})
