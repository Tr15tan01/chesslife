import type { Metadata } from 'next'
import { VerifyEmail } from '@/components/app/auth-forms'

export const metadata: Metadata = { title: 'Confirm email' }

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <VerifyEmail token={(await searchParams).token ?? ''} />
}
