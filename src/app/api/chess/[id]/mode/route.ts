import { route, readJson } from '@/server/http'
import { chessModeSchema, setChessMode } from '@/server/services/chess'

export const POST = route<{ id: string }>({ auth: true }, async ({ req, user, params }) => {
  const { mode } = await readJson(req, chessModeSchema)
  return setChessMode(user!, params.id, mode)
})
