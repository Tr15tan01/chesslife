import './_env'
import { getDb } from '@/server/db'
import { seedContent } from '@/server/content/seed'

/** Creates indexes (on connect) and seeds scenarios, academy and challenges. Idempotent. */
async function main() {
  const url = process.env.DATABASE_URL ?? ''
  if (!url || url.startsWith('memory://')) throw new Error('Set DATABASE_URL to your MongoDB Atlas connection string first.')
  const db = await getDb()
  console.log('Connected. Indexes ensured.')
  await seedContent(db, (m) => console.log(m))
  console.log('Done.')
  process.exit(0)
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
