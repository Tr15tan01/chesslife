import { z } from 'zod'
import { route, readJson } from '@/server/http'
import { changePassword } from '@/server/services/accounts'
import { startSession } from '@/server/auth/session'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route({ auth: true }, async ({ req, user }) => {
  await enforce(RULES.account, user!.id)
  const { current, next } = await readJson(req, z.object({ current: z.string().max(128).default(''), next: z.string().max(128) }))
  const updated = await changePassword(user!.id, current, next)
  // All sessions were revoked; issue a fresh one for this browser.
  if (updated) await startSession(updated)
  return { ok: true }
})
