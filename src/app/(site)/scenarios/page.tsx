import type { Metadata } from 'next'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { CATEGORIES, CATEGORY_LABELS, DIFFICULTY_LABELS, STYLE_LABELS, type CounterpartStyle, type Difficulty } from '@/lib/negotiation/types'
import { catalogQuerySchema, listScenarios } from '@/server/services/scenarios'
import { getSessionUser } from '@/server/auth/session'
import { cn } from '@/lib/cn'

export const metadata: Metadata = { title: 'Scenarios', description: 'Browse negotiation scenarios across careers, business, buying and selling, relationships and leadership.' }

export default async function ScenariosPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const raw = await searchParams
  const parsed = catalogQuerySchema.safeParse(raw)
  const q = parsed.success ? parsed.data : {}
  const user = await getSessionUser()
  const scenarios = await listScenarios(q, user?.id ?? null)
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { ...q, ...patch } as Record<string, string | number | undefined>
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== '') p.set(k, String(v))
    const s = p.toString()
    return `/scenarios${s ? `?${s}` : ''}`
  }
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 lg:px-8">
      <h1 className="display-lg">Scenario library</h1>
      <p className="lede mt-3">Every scenario has a counterpart with private priorities, limits and facts you can uncover. All are playable in Classic mode without AI.</p>

      <form action="/scenarios" className="mt-10 flex flex-col gap-3 md:flex-row md:items-center" role="search">
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input name="q" defaultValue={q.q} placeholder="Search scenarios" aria-label="Search scenarios" className="h-11 w-full rounded-full border border-line-strong bg-surface pl-10 pr-4 text-[15px] placeholder:text-ink-3 focus:border-gold focus:outline-none" />
          {q.category && <input type="hidden" name="category" value={q.category} />}
        </div>
        <nav aria-label="Categories" className="flex flex-wrap gap-1.5">
          <Link href={link({ category: undefined })} className={cn('rounded-full border px-3 py-1 text-[13px]', !q.category ? 'border-gold bg-gold/15 text-ink' : 'border-line text-ink-2 hover:text-ink')}>
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link key={c} href={link({ category: c })} aria-current={q.category === c ? 'page' : undefined} className={cn('rounded-full border px-3 py-1 text-[13px]', q.category === c ? 'border-gold bg-gold/15 text-ink' : 'border-line text-ink-2 hover:text-ink')}>
              {CATEGORY_LABELS[c]}
            </Link>
          ))}
          <Link href={link({ quick: q.quick ? undefined : '1' })} className={cn('rounded-full border px-3 py-1 text-[13px]', q.quick ? 'border-gold bg-gold/15 text-ink' : 'border-line text-ink-2 hover:text-ink')}>
            Quick rounds
          </Link>
        </nav>
      </form>

      {scenarios.length === 0 ? (
        <p className="mt-10 rounded-[14px] border border-dashed border-line-strong p-8 text-sm text-ink-2">
          No scenarios match. <Link href="/scenarios" className="text-gold hover:underline">Clear filters</Link>
        </p>
      ) : (
        <ul className="mt-10 divide-y divide-line border-y border-line">
          {scenarios.map((s) => (
            <li key={s.slug}>
              <Link href={`/scenarios/${s.slug}`} className="group grid gap-2 py-6 md:grid-cols-[1fr_220px_160px] md:items-center md:gap-8">
                <div>
                  <p className="text-[12.5px] text-ink-3">{s.custom ? 'Your custom scenario' : CATEGORY_LABELS[s.category]}</p>
                  <h2 className="mt-1 font-display text-2xl group-hover:text-gold-strong">{s.title}</h2>
                  <p className="mt-1 max-w-2xl text-sm text-ink-2">{s.summary}</p>
                </div>
                <p className="text-sm text-ink-3">
                  {s.counterpartName}, {STYLE_LABELS[s.counterpartStyle as CounterpartStyle].toLowerCase()}
                  <span className="block">Negotiating {s.issueLabels.join(', ').toLowerCase()}</span>
                </p>
                <div className="text-sm text-ink-3 md:text-right">
                  <span className="inline-flex gap-0.5 align-middle" aria-hidden>
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} className={cn('h-1.5 w-3 rounded-full', i <= s.difficulty ? 'bg-gold' : 'bg-surface-3')} />
                    ))}
                  </span>
                  <span className="ml-2">{DIFFICULTY_LABELS[s.difficulty as Difficulty]}</span>
                  <span className="block">About {s.estMinutes} min</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
