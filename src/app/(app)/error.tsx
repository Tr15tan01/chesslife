'use client'

import { Button } from '@/components/ui/button'

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-24">
      <h1 className="display-md">This page could not load</h1>
      <p className="mt-3 text-sm text-ink-2">Your saved negotiations are safe. Try again, and if it keeps happening, come back in a few minutes.</p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
