import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/app/app-shell'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { ConcessionLine, DifficultyBars, OutcomeStack, SkillBars, TrendChart, ActivityBars } from '@/components/charts/charts'
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/negotiation/types'
import { cn } from '@/lib/cn'
import { requireUser } from '@/server/auth/guard'
import { getProgress, progressQuerySchema } from '@/server/services/analytics'

export const metadata: Metadata = { title: 'Progress' }

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? 'true' : undefined} className={cn('rounded-full border px-3 py-1 text-[13px] transition-colors', active ? 'border-gold bg-gold/15 text-ink' : 'border-line text-ink-2 hover:text-ink')}>
      {children}
    </Link>
  )
}

export default async function ProgressPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser()
  const raw = await searchParams
  const parsed = progressQuerySchema.safeParse(raw)
  const q = parsed.success ? parsed.data : progressQuerySchema.parse({})
  const data = await getProgress(user.id, q)
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const m = { ...q, ...patch } as Record<string, string | undefined>
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v)
    return `/progress?${p.toString()}`
  }
  const t = data.totals
  return (
    <div className="pb-16">
      <PageHeader title="Progress" description="Every chart below is computed from your own completed negotiations. Objective outcomes and AI-assessed judgements are shown separately." />
      <div className="space-y-6 px-4 pt-6 sm:px-8">
        <div className="panel flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:gap-6">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Date range">
            <span className="mr-1 text-[12.5px] text-ink-3">Range</span>
            {(
              [
                ['30', '30 days'],
                ['90', '90 days'],
                ['365', '12 months'],
                ['all', 'All time'],
              ] as const
            ).map(([v, l]) => (
              <Chip key={v} href={href({ range: v })} active={q.range === v}>
                {l}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Mode">
            <span className="mr-1 text-[12.5px] text-ink-3">Mode</span>
            <Chip href={href({ mode: undefined })} active={!q.mode}>
              Both
            </Chip>
            <Chip href={href({ mode: 'CLASSIC' })} active={q.mode === 'CLASSIC'}>
              Classic
            </Chip>
            <Chip href={href({ mode: 'AI' })} active={q.mode === 'AI'}>
              AI
            </Chip>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Category">
            <span className="mr-1 text-[12.5px] text-ink-3">Category</span>
            <Chip href={href({ category: undefined })} active={!q.category}>
              All
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} href={href({ category: c })} active={q.category === c}>
                {CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
        </div>

        {t.games === 0 ? (
          <EmptyState title="No completed negotiations in this view" action={<Button asChild size="sm"><Link href="/play">Play a scenario</Link></Button>}>
            Finish a negotiation, or widen the filters above. Charts appear as soon as there is data.
          </EmptyState>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                ['Negotiations', t.games],
                ['Average score', t.avgScore ?? '—'],
                ['Agreement rate', t.agreementRate !== null ? `${t.agreementRate}%` : '—'],
                ['Walk-away decisions', t.walkAways],
                ['Avg concessions', t.avgConcessions ?? '—'],
                ['Lessons completed', t.lessons],
              ].map(([l, v]) => (
                <div key={l as string} className="panel px-4 py-3">
                  <dt className="text-[12.5px] text-ink-3">{l}</dt>
                  <dd className="tabular mt-1 font-display text-[1.75rem] leading-none">{v}</dd>
                </div>
              ))}
            </dl>
            <TrendChart data={data.overTime} title="Overall performance over time" height={280} />
            <div className="grid gap-6 xl:grid-cols-2">
              <SkillBars
                data={data.dimensions.map((d) => ({ dimension: d.dimension, score: d.rulesOnly, second: data.aiAssessedGames ? d.aiAssessed : undefined }))}
                title="Skill dimensions"
                description={data.aiAssessedGames ? 'Rules-only games versus games that include a bounded AI assessment.' : 'All games so far were scored by rules only.'}
              />
              <OutcomeStack data={data.byCategory} />
            </div>
            <div className="grid gap-6 xl:grid-cols-3">
              <DifficultyBars data={data.byDifficulty} />
              <ConcessionLine data={data.overTime} />
              <div className="panel p-5 sm:p-6">
                <p className="font-display text-[1.25rem]">Classic versus AI</p>
                <p className="mt-1 text-[13px] text-ink-3">Same scenarios, different conversation styles.</p>
                <dl className="mt-5 grid grid-cols-2 gap-4">
                  {data.byMode.map((m) => (
                    <div key={m.mode} className="rounded-[12px] border border-line p-4">
                      <dt className="text-[13px] text-ink-2">{m.mode === 'AI' ? 'AI negotiation' : 'Classic'}</dt>
                      <dd className="tabular mt-2 font-display text-3xl">{m.avgScore ?? '—'}</dd>
                      <dd className="text-[12px] text-ink-3">
                        {m.games} games{m.agreementRate !== null ? `, ${m.agreementRate}% agreed` : ''}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <ActivityBars data={data.training} />
            <div className="panel p-5 sm:p-6">
              <p className="font-display text-[1.25rem]">Negotiations in this view</p>
              <ul className="mt-3 divide-y divide-line">
                {[...data.overTime].reverse().map((g) => (
                  <li key={g.gameId}>
                    <Link href={`/results/${g.gameId}`} className="flex items-center gap-4 py-2.5 text-sm hover:text-gold-strong">
                      <span className="flex-1 text-ink">{g.title}</span>
                      <span className="text-[12.5px] text-ink-3">{new Date(g.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      <span className="tabular w-8 text-right font-display text-lg">{g.overall}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[12.5px] text-ink-3">An increasing game score shows improvement inside these scenarios. It is not proof of improved real-world negotiation ability.</p>
          </>
        )}
      </div>
    </div>
  )
}
