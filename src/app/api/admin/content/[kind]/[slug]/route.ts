import { z } from 'zod'
import { route, readJson, Errors } from '@/server/http'
import { setPublished } from '@/server/services/admin'

export const PATCH = route<{ kind: string; slug: string }>({ permission: 'content:manage' }, async ({ req, user, params }) => {
  if (params.kind !== 'program' && params.kind !== 'lesson') throw Errors.notFound()
  const { published } = await readJson(req, z.object({ published: z.boolean() }))
  return setPublished(user!, params.kind, params.slug, published)
})
