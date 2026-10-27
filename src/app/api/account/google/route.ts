import { route, Errors } from '@/server/http'
import { getDb } from '@/server/db'
import { audit } from '@/server/services/logging'

export const DELETE = route({ auth: true }, async ({ user }) => {
  if (!user!.hasPassword) throw Errors.invalid('Set a password before unlinking Google, or you will be locked out.')
  const db = await getDb()
  await db.oauthAccounts.deleteMany({ userId: user!.id, provider: 'google' })
  await audit({ id: user!.id, email: user!.email }, 'auth.google_unlinked', 'user', user!.id)
  return { ok: true }
})
