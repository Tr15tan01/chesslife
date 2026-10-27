import 'server-only'
import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getSessionUser, type SessionUser } from './session'
import { can, type Permission } from './permissions'

/** Server Component guard: redirects to sign-in when there is no valid session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    const h = await headers()
    const path = h.get('x-pathname') ?? '/dashboard'
    redirect(`/login?next=${encodeURIComponent(path)}`)
  }
  return user
}

/** Unauthorised users see a 404, which does not confirm the page exists. */
export async function requirePermission(p: Permission): Promise<SessionUser> {
  const user = await requireUser()
  if (!can(user.role, p)) notFound()
  return user
}
