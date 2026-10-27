import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { LoginForm } from '@/components/app/auth-forms'
import { getSessionUser } from '@/server/auth/session'
import { isGoogleEnabled } from '@/server/env'
import { safeRedirect } from '@/server/security/redirect'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams
  const next = safeRedirect(sp.next)
  if (await getSessionUser()) redirect(next)
  return <LoginForm next={next} google={isGoogleEnabled()} oauthError={sp.error} />
}
