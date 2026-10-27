import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetForm } from '@/components/app/auth-forms'

export const metadata: Metadata = { title: 'Choose a new password' }

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? ''
  if (!token)
    return (
      <div>
        <h1 className="display-md">Link missing</h1>
        <p className="mt-3 text-sm text-ink-2">
          Open the link from your email, or <Link href="/forgot-password" className="text-gold hover:underline">request a new one</Link>.
        </p>
      </div>
    )
  return <ResetForm token={token} />
}
