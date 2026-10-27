import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { RegisterForm } from '@/components/app/auth-forms'
import { getSessionUser } from '@/server/auth/session'
import { isGoogleEnabled } from '@/server/env'
import { safeRedirect } from '@/server/security/redirect'

export const metadata: Metadata = { title: 'Create account' }

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeRedirect((await searchParams).next)
  if (await getSessionUser()) redirect(next)
  return <RegisterForm next={next} google={isGoogleEnabled()} />
}
