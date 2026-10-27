import { route } from '@/server/http'
import { endSession, revokeAllSessions } from '@/server/auth/session'

export const POST = route({ auth: true }, async ({ user }) => {
  await revokeAllSessions(user!.id)
  await endSession()
  return { ok: true }
})
