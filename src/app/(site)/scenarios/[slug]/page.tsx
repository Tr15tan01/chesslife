import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Clock, Flag, Target, Trophy } from 'lucide-react'
import { CATEGORY_LABELS, DIFFICULTY_LABELS, STYLE_LABELS } from '@/lib/negotiation/types'
import { formatValue } from '@/lib/negotiation/format'
import { getScenarioPublic } from '@/server/services/scenarios'
import { getSessionUser } from '@/server/auth/session'
import { aiAvailable } from '@/server/services/flags'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/marketing/avatar'
import { StartButton } from '@/components/play/start-button'
import { HeroVisual } from '@/components/three/hero-visual'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const r = await getScenarioPublic((await params).slug)
  return r ? { title: r.pub.title, description: r.pub.summary } : { title: 'Scenario' }
}

export default async function ScenarioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getSessionUser()
  const r = await getScenarioPublic(slug, user?.id ?? null)
  if (!r) notFound()
  const s = r.pub
  const ai = await aiAvailable()
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3">
        <Link href="/scenarios" className="hover:text-ink">
          Scenarios
        </Link>
        <span className="mx-2">/</span>
        <span>{CATEGORY_LABELS[s.category]}</span>
      </nav>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <h1 className="display-lg">{s.title}</h1>
          <p className="lede mt-4">{s.description}</p>
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-ink-3">Difficulty</dt>
              <dd className="text-ink">{DIFFICULTY_LABELS[s.difficulty]}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Length</dt>
              <dd className="inline-flex items-center gap-1 text-ink">
                <Clock className="size-3.5" aria-hidden /> About {s.estMinutes} min
              </dd>
            </div>
            <div>
              <dt className="text-ink-3">Your role</dt>
              <dd className="text-ink">{s.playerRole}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Turn limit</dt>
              <dd className="text-ink">{s.maxTurns} moves</dd>
            </div>
          </dl>
          <div className="mt-10 space-y-8">
            <section>
              <h2 className="font-display text-2xl">What you are negotiating</h2>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {s.issues.map((i) => (
                  <li key={i.key} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                    <span className="text-ink">{i.label}</span>
                    <span className="text-ink-3">
                      Range {formatValue(i, i.min)} to {formatValue(i, i.max)}. You want it {i.playerPrefers === 'higher' ? 'higher' : 'lower'}; your limit is {formatValue(i, s.brief.limits[i.key])}.
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="grid gap-6 sm:grid-cols-2">
              <div>
                <h2 className="inline-flex items-center gap-2 font-display text-xl">
                  <Flag className="size-4 text-gold" aria-hidden /> Objectives
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
                  {s.publicObjectives.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="inline-flex items-center gap-2 font-display text-xl">
                  <Target className="size-4 text-gold" aria-hidden /> What you will practise
                </h2>
                <p className="mt-2 text-sm text-ink-2">{s.learningObjective}</p>
              </div>
              <div>
                <h2 className="inline-flex items-center gap-2 font-display text-xl">
                  <Trophy className="size-4 text-gold" aria-hidden /> A strong result
                </h2>
                <p className="mt-2 text-sm text-ink-2">{s.successLooksLike}</p>
              </div>
              <div>
                <h2 className="font-display text-xl">Realistic range</h2>
                <p className="mt-2 text-sm text-ink-2">{s.outcomeRange}</p>
              </div>
            </section>
          </div>
        </div>
        <aside className="space-y-6">
          <div className="relative hidden h-64 overflow-hidden rounded-[18px] border border-line bg-bg-deep lg:block">
            <HeroVisual className="absolute inset-0" />
          </div>
          <div className="panel p-6">
            <div className="flex items-center gap-4">
              <Avatar name={s.counterpart.name} tone={s.counterpart.tone} size="lg" />
              <div>
                <p className="font-display text-2xl">{s.counterpart.name}</p>
                <p className="text-sm text-ink-3">{s.counterpart.role}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-ink-2">{s.counterpart.bio}</p>
            <p className="mt-2 text-sm text-ink-3">Style: {STYLE_LABELS[s.counterpart.style].toLowerCase()}. Their limits and private facts stay hidden until the game ends.</p>
            <div className="mt-6 space-y-2">
              {user ? (
                <>
                  <StartButton className="w-full" input={{ slug: s.slug, mode: 'CLASSIC', variant: s.quick ? 'QUICK' : 'STANDARD' }}>
                    Play in Classic mode
                  </StartButton>
                  <StartButton className="w-full" variant="secondary" disabled={!ai} input={{ slug: s.slug, mode: 'AI' }}>
                    {ai ? 'Play with the AI character' : 'AI mode unavailable'}
                  </StartButton>
                  <StartButton className="w-full" variant="ghost" input={{ slug: s.slug, mode: 'CLASSIC', timed: true }}>
                    Play timed ({Math.round(s.defaultTimeLimitSec / 60)} min)
                  </StartButton>
                </>
              ) : (
                <>
                  <Button asChild className="w-full">
                    <Link href={`/register?next=${encodeURIComponent(`/scenarios/${s.slug}`)}`}>Create a free account to play</Link>
                  </Button>
                  <Button asChild variant="ghost" className="w-full">
                    <Link href={`/login?next=${encodeURIComponent(`/scenarios/${s.slug}`)}`}>I already have an account</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="panel p-5 text-sm text-ink-2">
            <p className="text-ink">How they open</p>
            <p className="mt-2 font-display text-lg italic text-ink">“{s.opening}”</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
