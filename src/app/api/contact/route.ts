import { z } from 'zod'
import { route, readJson } from '@/server/http'
import { getDb } from '@/server/db'
import { emailSchema } from '@/server/security/password'
import { enforce, RULES } from '@/server/security/rate-limit'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
  email: emailSchema,
  topic: z.enum(['general', 'support', 'privacy', 'partnership']),
  message: z.string().trim().min(10, 'Write at least a sentence.').max(2000),
  website: z.string().max(0).optional(), // honeypot
})

export const POST = route({}, async ({ req, ip, user }) => {
  await enforce(RULES.contact, ip)
  const body = await readJson(req, schema)
  await (await getDb()).contact.insertOne({ _id: crypto.randomUUID(), name: body.name, email: body.email, topic: body.topic, message: body.message, createdAt: new Date(), userId: user?.id ?? null })
  return { ok: true }
})
