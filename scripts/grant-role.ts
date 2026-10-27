import './_env'
import { getDb } from '@/server/db'
import { audit } from '@/server/services/logging'

/**
 * Securely assign a role from the server shell (never from the web UI):
 *   npm run admin:grant -- someone@example.com ADMIN
 * Roles: USER | CONTENT_MANAGER | ADMIN. Existing sessions are revoked.
 */
async function main() {
  const [email, role] = process.argv.slice(2)
  if (!email || !role || !['USER', 'CONTENT_MANAGER', 'ADMIN'].includes(role)) {
    console.error('Usage: npm run admin:grant -- <email> <USER|CONTENT_MANAGER|ADMIN>')
    process.exit(2)
  }
  const db = await getDb()
  const user = await db.users.findOne({ email: email.toLowerCase() })
  if (!user) throw new Error(`No user with email ${email}. Ask them to register first.`)
  await db.users.updateOne({ _id: user._id }, { $set: { role: role as 'USER', updatedAt: new Date() }, $inc: { authVersion: 1 } })
  await db.sessions.deleteMany({ userId: user._id })
  await audit(null, 'user.role_changed', 'user', user._id, { to: role, via: 'cli' })
  console.log(`${email} is now ${role}. Their sessions were signed out.`)
  process.exit(0)
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
