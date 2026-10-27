import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageIntro } from '@/components/marketing/prose'

export const metadata: Metadata = { title: 'Pricing' }

export default function Pricing() {
  return (
    <>
      <PageIntro title="Pricing">DealCraft is free while in early access. Paid plans are planned but not yet available, and nothing here will charge you.</PageIntro>
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-2">
        <section className="panel flex flex-col border-gold/50 p-7">
          <h2 className="font-display text-3xl">Free</h2>
          <p className="mt-1 text-sm text-ink-3">Available now</p>
          <p className="mt-6 font-display text-5xl">$0</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm text-ink-2">
            {['Every scenario in Classic mode, unlimited', 'A daily allowance of AI negotiation turns, when the server has AI enabled', 'Full debriefs, replay and progress charts', 'Negotiation Academy and challenges', 'Custom scenarios'].map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <Button asChild className="mt-8">
            <Link href="/register">Create a free account</Link>
          </Button>
        </section>
        <section className="panel flex flex-col p-7">
          <h2 className="font-display text-3xl">Premium</h2>
          <p className="mt-1 text-sm text-ink-3">Planned, not yet available</p>
          <p className="mt-6 font-display text-5xl text-ink-3">—</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm text-ink-2">
            {['Higher daily AI limits', 'Advanced scenarios', 'Personalised training plans'].map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-[13px] text-ink-3">When billing launches, plan status will come only from verified payment-provider events, never from the browser.</p>
        </section>
      </div>
    </>
  )
}
