import { z } from 'zod'
import { route, readJson } from '@/server/http'
import { setUserRole, setUserStatus } from '@/server/services/admin'
import { enforce, RULES } from '@/server/security/rate-limit'

const schema = z.union([z.object({ role: z.enum(['USER', 'ADMIN', 'CONTENT_MANAGER']) }), z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) })])

export const PATCH = route<{ id: string }>({ permission: 'admin:users' }, async ({ req, user, params }) => {
  await enforce(RULES.admin, user!.id)
  const body = await readJson(req, schema)
  return 'role' in body ? setUserRole(user!, params.id, body.role) : setUserStatus(user!, params.id, body.status)
})
