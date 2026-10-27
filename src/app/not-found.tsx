import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/logo'

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <Logo className="justify-center" />
        <h1 className="display-lg mt-10">Nothing on this table</h1>
        <p className="mt-3 text-ink-2">The page you were looking for does not exist, or you do not have access to it.</p>
        <Button asChild className="mt-8">
          <Link href="/">Back to DealCraft</Link>
        </Button>
      </div>
    </main>
  )
}
