import { z } from 'zod'
import { route, readJson } from '@/server/http'
import { saveNotes } from '@/server/services/games'

export const PUT = route<{ id: string }>({ auth: true }, async ({ req, user, params }) => {
  const { notes } = await readJson(req, z.object({ notes: z.string().max(2000) }))
  return saveNotes(user!, params.id, notes)
})
