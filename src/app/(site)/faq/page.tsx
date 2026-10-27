import type { Metadata } from 'next'
import { PageIntro } from '@/components/marketing/prose'
import { FAQ_ITEMS } from '@/components/marketing/faq-data'

export const metadata: Metadata = { title: 'FAQ' }

export default function Faq() {
  return (
    <>
      <PageIntro title="Frequently asked questions" />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="divide-y divide-line border-y border-line">
          {FAQ_ITEMS.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium text-ink">
                {f.q}
                <span className="text-xl text-gold transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-[15px] text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </>
  )
}
