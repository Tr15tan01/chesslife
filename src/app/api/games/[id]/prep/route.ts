import { route, readJson } from '@/server/http'
import { prepSchema, submitPrep } from '@/server/services/games'

export const POST = route<{ id: string }>({ auth: true }, async ({ req, user, params }) => submitPrep(user!, params.id, await readJson(req, prepSchema)))
