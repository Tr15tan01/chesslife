import { route } from '@/server/http'
import { deleteCustomScenario } from '@/server/services/custom'

export const DELETE = route<{ slug: string }>({ auth: true }, async ({ user, params }) => deleteCustomScenario(user!, params.slug))
