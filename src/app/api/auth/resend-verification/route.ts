import { route } from '@/server/http'
import { getDb } from '@/server/db'
import { sendVerification } from '@/server/services/accounts'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route({ auth: true }, async ({ user }) => {
  await enforce(RULES.account, user!.id)
  const doc = await (await getDb()).users.findOne({ _id: user!.id })
  const sent = doc ? await sendVerification(doc) : false
  return { ok: true, sent }
})
