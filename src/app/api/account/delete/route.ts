import { z } from 'zod'
import { route, readJson } from '@/server/http'
import { deleteAccount } from '@/server/services/accounts'
import { endSession } from '@/server/auth/session'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route({ auth: true }, async ({ req, user }) => {
  await enforce(RULES.account, user!.id)
  const body = await readJson(req, z.object({ password: z.string().max(128).optional(), phrase: z.string().max(20).optional() }))
  await deleteAccount(user!.id, body)
  await endSession()
  return { ok: true }
})
