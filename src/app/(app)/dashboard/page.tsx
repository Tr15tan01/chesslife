import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowUpRight, BookOpen, Flame, Lightbulb, MessagesSquare, Puzzle, Swords, Timer, Zap } from 'lucide-react'
import { PageHeader } from '@/components/app/app-shell'
import { Button } from '@/components/ui/button'
import { EmptyState, Panel, PanelTitle } from '@/components/ui/misc'
import { ActivityBars, SkillBars, TrendChart } from '@/components/charts/charts'
import { StatusBadge, relativeDate } from '@/components/app/status'
import { CATEGORY_LABELS, DIFFICULTY_LABELS, DIMENSION_LABELS, type Difficulty, type Category } from '@/lib/negotiation/types'
import { requireUser } from '@/server/auth/guard'
import { plural } from '@/lib/cn'
import { getDashboard } from '@/server/services/analytics'

export const metadata: Metadata = { title: 'Dashboard' }

function greeting() {
  const h = new Date().getUTCHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="panel px-5 py-4">
      <p className="text-[13px] text-ink-3">{label}</p>
      <p className="tabular mt-1 font-display text-[2rem] leading-none text-ink">{value}</p>
      {hint && <p className="mt-2 text-[12.5px] text-ink-3">{hint}</p>}
    </div>
  )
}

export default async function DashboardPage() {
  const user = await requireUser()
  const d = await getDashboard(user.id)
  const first = user.name.split(' ')[0]
  const p = d.progress
  const isNew = p.gamesCompleted === 0

  return (
    <div className="pb-16">
      <PageHeader
        title={`${greeting()}, ${first}.`}
        description={
          isNew ? (
            'Your training room is ready. Start with a short scenario; your charts fill in as you play.'
          ) : (
            <span className="inline-flex flex-wrap items-center gap-x-2">
              {p.streak.current > 0 && (
                <span className="inline-flex items-center gap-1 text-gold">
                  <Flame className="size-4" aria-hidden /> {p.streak.current}-day streak
                </span>
              )}
              <span>
                {d.trendDelta !== null ? (d.trendDelta >= 0 ? `Your recent scores are up ${d.trendDelta} points on your earlier sessions.` : `Your recent scores are ${Math.abs(d.trendDelta)} points below your earlier sessions. Harder scenarios do that.`) : 'Keep going to unlock trend insights.'}
              </span>
            </span>
          )
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/play?quick=1">
                <Zap className="size-4" aria-hidden /> Quick round
              </Link>
            </Button>
            <Button asChild>
              <Link href="/play">Start a negotiation</Link>
            </Button>
          </>
        }
      />

      <div className="space-y-6 px-4 pt-6 sm:px-8">
        {d.active.length > 0 && (
          <div className="panel flex flex-col gap-3 border-gold/40 p-4 sm:flex-row sm:items-center">
            <p className="text-sm text-ink-2">
              <span className="text-ink">Unfinished: </span>
              {d.active[0]!.title}, {relativeDate(d.active[0]!.updatedAt)}
            </p>
            <Button asChild size="sm" className="sm:ml-auto">
              <Link href={`/play/${d.active[0]!.id}`}>Resume</Link>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Negotiations completed" value={p.gamesCompleted} hint={p.gamesCompleted ? `${plural(p.agreements, 'agreement')}, ${plural(p.walkAways, 'walk-away')}` : 'None yet'} />
          <Stat label="Best overall score" value={p.bestScore || '—'} hint="Out of 100" />
          <Stat label="Training streak (days)" value={p.streak.current} hint={`Best: ${plural(p.streak.best, 'day')}`} />
          <Stat label="Lessons completed" value={`${p.lessonsDone}/${p.totalLessons}`} hint={`${plural(p.challengesPassed, 'challenge')} passed`} />
        </div>

        {isNew ? (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Panel>
              <PanelTitle>Start here</PanelTitle>
              <ol className="space-y-3">
                {d.suggested.map((s, i) => (
                  <li key={s.slug}>
                    <Link href={`/scenarios/${s.slug}`} className="group flex items-center gap-4 rounded-[12px] border border-line p-4 transition-colors hover:border-gold/50">
                      <span className="tabular font-display text-2xl text-gold">{i + 1}</span>
                      <span className="flex-1">
                        <span className="block font-medium text-ink group-hover:text-gold-strong">{s.title}</span>
                        <span className="block text-[13px] text-ink-3">
                          {CATEGORY_LABELS[s.category as Category]}, about {s.estMinutes} min
                        </span>
                      </span>
                      <ArrowUpRight className="size-4 text-ink-3 group-hover:text-gold" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ol>
            </Panel>
            <Panel>
              <PanelTitle>Before your first deal</PanelTitle>
              <ul className="space-y-4 text-sm text-ink-2">
                {d.tips.map((t) => (
                  <li key={t.dimension} className="flex gap-3">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                    {t.tip}
                  </li>
                ))}
              </ul>
              {d.upcomingLesson && (
                <Button asChild variant="secondary" className="mt-6">
                  <Link href={`/training/${d.upcomingLesson.slug}`}>
                    <BookOpen className="size-4" aria-hidden /> {d.upcomingLesson.title}
                  </Link>
                </Button>
              )}
            </Panel>
          </div>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
              <TrendChart data={d.trend.map((t) => ({ ...t }))} title="Recent performance" />
              <Panel className="flex flex-col">
                <PanelTitle>Practise next</PanelTitle>
                <ul className="space-y-5">
                  {d.tips.map((t) => (
                    <li key={t.dimension}>
                      <p className="text-[13px] font-medium text-gold">{DIMENSION_LABELS[t.dimension]}</p>
                      <p className="mt-1 flex gap-2.5 text-sm text-ink-2">
                        <Lightbulb className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                        {t.tip}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto space-y-2 pt-6">
                  <p className="text-[13px] text-ink-3">Scenarios that train these skills</p>
                  {d.suggested.map((s) => (
                    <Link key={s.slug} href={`/scenarios/${s.slug}`} className="group flex items-center justify-between rounded-[10px] border border-line px-3 py-2.5 text-sm transition-colors hover:border-gold/50">
                      <span className="text-ink group-hover:text-gold-strong">{s.title}</span>
                      <span className="text-[12px] text-ink-3">{DIFFICULTY_LABELS[s.difficulty as Difficulty]}</span>
                    </Link>
                  ))}
                </div>
              </Panel>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <SkillBars data={d.dims} description="Average across your last ten negotiations." height={280} />
              <ActivityBars data={d.activity} height={280} title="Last eight weeks" />
            </div>
          </>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Panel>
            <PanelTitle
              action={
                <Link href="/history" className="text-[13px] text-gold hover:underline">
                  All history
                </Link>
              }
            >
              Recent negotiations
            </PanelTitle>
            {d.recent.length === 0 ? (
              <EmptyState title="No negotiations yet" action={<Button asChild size="sm"><Link href="/play">Pick a scenario</Link></Button>}>
                Finished games appear here with their scores and outcomes.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {d.recent.map((g) => (
                  <li key={g.id}>
                    <Link href={['AGREEMENT_REACHED', 'WALKED_AWAY', 'FAILED', 'EXPIRED'].includes(g.status) ? `/results/${g.id}` : `/play/${g.id}`} className="group flex items-center gap-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-ink group-hover:text-gold-strong">{g.title}</span>
                        <span className="text-[12.5px] text-ink-3">
                          {CATEGORY_LABELS[g.category]}, {g.mode === 'AI' ? 'AI' : 'Classic'}, {relativeDate(g.createdAt)}
                        </span>
                      </span>
                      <StatusBadge status={g.status} />
                      <span className="tabular w-10 text-right font-display text-xl text-ink">{g.score ?? '—'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel>
            <PanelTitle>Quick access</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['/play?mode=CLASSIC', Swords, 'Classic', 'No AI needed'],
                ['/play?mode=AI', MessagesSquare, 'AI negotiation', d.aiAvailable ? 'Free-text chat' : 'Unavailable now'],
                ['/play?quick=1', Zap, 'Quick round', '2–5 minutes'],
                ['/play?timed=1', Timer, 'Timed', 'Server clock'],
                ['/challenges', Flame, 'Challenges', 'Objective goals'],
                ['/custom', Puzzle, 'Custom', 'Your real case'],
              ].map(([href, Icon, t, s]) => {
                const I = Icon as typeof Zap
                return (
                  <Link key={href as string} href={href as string} className="group rounded-[12px] border border-line p-3 transition-colors hover:border-gold/50">
                    <I className="size-4 text-gold" aria-hidden />
                    <p className="mt-2 text-sm font-medium text-ink">{t as string}</p>
                    <p className="text-[12px] text-ink-3">{s as string}</p>
                  </Link>
                )
              })}
            </div>
            {d.upcomingLesson && (
              <Link href={`/training/${d.upcomingLesson.slug}`} className="mt-4 flex items-center gap-3 rounded-[12px] bg-surface-2 p-3 text-sm transition-colors hover:bg-surface-3">
                <BookOpen className="size-4 text-gold" aria-hidden />
                <span className="flex-1">
                  <span className="block text-ink">Next lesson: {d.upcomingLesson.title}</span>
                  <span className="text-[12px] text-ink-3">
                    {d.upcomingLesson.program}, {d.upcomingLesson.minutes} min
                  </span>
                </span>
              </Link>
            )}
          </Panel>
        </div>
        <p className="text-[12.5px] text-ink-3">Scores reflect what you did inside DealCraft scenarios. They are a practice signal, not proof of real-world negotiation ability.</p>
      </div>
    </div>
  )
}
