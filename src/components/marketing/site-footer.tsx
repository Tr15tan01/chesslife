import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

const COLS = [
  { title: 'Product', links: [['Scenarios', '/scenarios'], ['How it works', '/how-it-works'], ['Features', '/features'], ['Pricing', '/pricing']] },
  { title: 'Learn', links: [['Negotiation Academy', '/training'], ['Challenges', '/challenges'], ['FAQ', '/faq']] },
  { title: 'Company', links: [['About', '/about'], ['Contact', '/contact'], ['Privacy', '/privacy'], ['Terms', '/terms']] },
] as const

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bg-deep">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div className="max-w-xs space-y-3">
          <Logo />
          <p className="text-sm text-ink-3">A practice room for negotiation. Scores reflect what you did inside each scenario, not a guarantee of real-world results.</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h2 className="mb-3 font-sans text-[13px] font-semibold text-ink-2">{c.title}</h2>
            <ul className="space-y-2">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-ink-3 transition-colors hover:text-ink">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-[13px] text-ink-3 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} DealCraft</p>
          <p>Built for practice, not for pressure.</p>
        </div>
      </div>
    </footer>
  )
}
