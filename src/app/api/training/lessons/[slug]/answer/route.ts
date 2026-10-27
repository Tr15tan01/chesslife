import { z } from 'zod'
import { route, readJson } from '@/server/http'
import { answerLesson } from '@/server/services/training'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route<{ slug: string }>({ auth: true }, async ({ req, user, params }) => {
  await enforce(RULES.turn, user!.id)
  const { answer } = await readJson(req, z.object({ answer: z.number().int().min(0).max(9) }))
  return answerLesson(user!.id, params.slug, answer)
})
