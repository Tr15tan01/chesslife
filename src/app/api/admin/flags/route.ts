import { route, readJson } from '@/server/http'
import { flagSchema, setFlag } from '@/server/services/admin'

export const PUT = route({ permission: 'admin:flags' }, async ({ req, user }) => setFlag(user!, await readJson(req, flagSchema)))
