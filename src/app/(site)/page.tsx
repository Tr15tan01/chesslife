import Link from 'next/link'
import { BookOpen, Clock, Flag, MessagesSquare, Puzzle, RotateCcw, Swords, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HeroVisual } from '@/components/three/hero-visual'
import { LivePreview } from '@/components/marketing/live-preview'
import { Avatar } from '@/components/marketing/avatar'
import { DimensionBars } from '@/components/results/dimension-bars'
import { CATEGORY_LABELS, DIFFICULTY_LABELS, STYLE_LABELS, CATEGORIES, type CounterpartStyle } from '@/lib/negotiation/types'
import { formatTerms } from '@/lib/negotiation/format'
import { categoryCounts, listScenarios } from '@/server/services/scenarios'
import { sampleReport } from '@/server/services/showcase'
import { getDb } from '@/server/db'
import { FAQ_ITEMS } from '@/components/marketing/faq-data'

export default async function HomePage() {
  const [counts, scenarios, report, db] = await Promise.all([categoryCounts(), listScenarios({}), sampleReport(), getDb()])
  const [programs, challenges] = await Promise.all([db.programs.countDocuments({ published: true }), db.challenges.countDocuments({ published: true })])
  const featured = ['negotiate-job-offer', 'supplier-contract', 'respect-a-boundary'].map((s) => scenarios.find((x) => x.slug === s)).filter(Boolean)
  const seen = new Set<string>()
  const characters = scenarios.filter((s) => (seen.has(s.counterpartStyle) ? false : (seen.add(s.counterpartStyle), true))).slice(0, 6)

  return (
    <>
      {/* Hero */}
      <section className="grain relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_75%_35%,color-mix(in_oklab,var(--gold)_14%,transparent),transparent_70%),radial-gradient(50%_60%_at_10%_90%,color-mix(in_oklab,var(--glow-cool)_80%,transparent),transparent_70%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-16 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:px-8 lg:pb-24">
          <div className="relative z-10 flex flex-col justify-center">
            <h1 className="display-xl animate-rise">
              Master the Art
              <br />
              of Negotiation.
            </h1>
            <p className="lede mt-6 animate-rise [animation-delay:120ms]">Practise real-world conversations, challenge intelligent opponents, and learn to negotiate with confidence.</p>
            <div className="mt-8 flex flex-wrap gap-3 animate-rise [animation-delay:220ms]">
              <Button asChild size="lg">
                <Link href="/register">Start Negotiating</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/scenarios">Explore Scenarios</Link>
              </Button>
            </div>
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 text-sm animate-rise [animation-delay:320ms]">
              <div>
                <dt className="text-ink-3">Scenarios</dt>
                <dd className="tabular font-display text-2xl text-ink">{scenarios.length}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Training paths</dt>
                <dd className="tabular font-display text-2xl text-ink">{programs}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Challenges</dt>
                <dd className="tabular font-display text-2xl text-ink">{challenges}</dd>
              </div>
            </dl>
          </div>
          <div className="relative min-h-[340px] sm:min-h-[440px] lg:-mr-24 lg:min-h-[560px]">
            <HeroVisual className="absolute inset-0" />
          </div>
          <div className="relative z-10 lg:col-span-2 lg:-mt-28 lg:ml-auto lg:w-[min(100%,40rem)]">
            <LivePreview />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-line" aria-labelledby="how">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 id="how" className="display-lg">
                Three steps, every time.
              </h2>
              <p className="lede mt-4">The same loop experienced negotiators run in their heads, made visible so you can practise it.</p>
            </div>
            <ol className="grid gap-px overflow-hidden rounded-[18px] border border-line bg-line sm:grid-cols-3">
              {[
                ['Prepare', 'Set a target, a walk-away point and a plan. Know your alternative before you speak.'],
                ['Negotiate', 'Ask questions, make offers and respond to a counterpart with their own hidden priorities.'],
                ['Review', 'See your scores, the moments that mattered, and what a different move would have changed.'],
              ].map(([t, d], i) => (
                <li key={t} className="bg-surface p-6">
                  <span className="tabular font-display text-3xl text-gold">{i + 1}</span>
                  <h3 className="mt-6 font-display text-xl">{t}</h3>
                  <p className="mt-2 text-sm text-ink-2">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Scenarios */}
      <section className="border-t border-line bg-bg-deep/50" aria-labelledby="scenarios">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
          <div>
            <h2 id="scenarios" className="display-lg">
              Situations you will actually face.
            </h2>
            <p className="lede mt-4">From asking for a raise to selling a company. Each scenario has a counterpart with constraints you have to discover.</p>
            <ul className="mt-8 divide-y divide-line border-y border-line">
              {CATEGORIES.map((c) => (
                <li key={c}>
                  <Link href={`/scenarios?category=${c}`} className="group flex items-center justify-between py-3 text-[15px] text-ink-2 transition-colors hover:text-ink">
                    {CATEGORY_LABELS[c]}
                    <span className="tabular text-sm text-ink-3 group-hover:text-gold">{counts[c]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4">
            {featured.map((s) => (
              <Link key={s!.slug} href={`/scenarios/${s!.slug}`} className="group panel flex flex-col gap-4 p-6 transition-colors hover:border-gold/50 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="text-[13px] text-ink-3">
                    {CATEGORY_LABELS[s!.category]}, {DIFFICULTY_LABELS[s!.difficulty].toLowerCase()}
                  </p>
                  <h3 className="mt-1 font-display text-2xl group-hover:text-gold-strong">{s!.title}</h3>
                  <p className="mt-2 text-sm text-ink-2">{s!.summary}</p>
                </div>
                <div className="shrink-0 text-sm text-ink-3 sm:w-40 sm:text-right">
                  <p>Negotiating {s!.issueLabels.join(', ').toLowerCase()}</p>
                  <p className="mt-1">About {s!.estMinutes} minutes</p>
                </div>
              </Link>
            ))}
            <Link href="/scenarios" className="text-sm text-gold hover:underline">
              Browse all {scenarios.length} scenarios
            </Link>
          </div>
        </div>
      </section>

      {/* Modes */}
      <section className="border-t border-line" aria-labelledby="modes">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 id="modes" className="display-lg max-w-2xl">
            Choose how you want to train.
          </h2>
          <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [MessagesSquare, 'AI negotiation', 'Free-text conversation with a character who has hidden objectives and will not simply agree.'],
              [Swords, 'Classic', 'Structured questions, offers and counteroffers with deterministic rules. No AI required.'],
              [Zap, 'Quick rounds', 'Two-to-five-minute scenarios with one clear takeaway and instant restart.'],
              [Clock, 'Timed', 'A server-enforced clock. Decide what to learn and when to offer under pressure.'],
              [BookOpen, 'Academy', `${programs} short learning paths, each with a worked example and a practice scenario.`],
              [Flag, 'Challenges', 'Objective goals such as finishing within five turns or recognising when to walk away.'],
              [RotateCcw, 'Replay and improve', 'Rewind to any move in a finished negotiation and try a different approach.'],
              [Puzzle, 'Custom scenarios', 'Describe your real upcoming negotiation and rehearse it before it happens.'],
            ].map(([Icon, title, desc]) => {
              const I = Icon as typeof Zap
              return (
                <div key={title as string}>
                  <I className="size-5 text-gold" aria-hidden />
                  <h3 className="mt-4 font-sans text-[15px] font-semibold text-ink">{title as string}</h3>
                  <p className="mt-1.5 text-sm text-ink-2">{desc as string}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Characters */}
      <section className="border-t border-line bg-bg-deep/50" aria-labelledby="characters">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <h2 id="characters" className="display-lg max-w-xl">
              Meet the people across the table.
            </h2>
            <p className="max-w-md text-sm text-ink-2">Difficulty changes how much they share, how fast they concede and how they react to pressure — not just how rude they are.</p>
          </div>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-[18px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((s) => (
              <li key={s.slug} className="flex gap-4 bg-surface p-6">
                <Avatar name={s.counterpartName} tone={(['gold', 'slate', 'sage', 'rose', 'ink'] as const)[s.counterpartName.length % 5]} size="lg" />
                <div>
                  <p className="font-display text-xl">{s.counterpartName}</p>
                  <p className="text-sm text-ink-3">{s.counterpartRole}</p>
                  <p className="mt-3 text-sm text-ink-2">
                    <span className="text-gold">{STYLE_LABELS[s.counterpartStyle as CounterpartStyle]}</span> in{' '}
                    <Link href={`/scenarios/${s.slug}`} className="underline-offset-4 hover:underline">
                      {s.title.toLowerCase()}
                    </Link>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Analysis */}
      {report && (
        <section className="border-t border-line" aria-labelledby="analysis">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <h2 id="analysis" className="display-lg">
                A debrief that tells you what to change.
              </h2>
              <p className="lede mt-4">Measurable facts, like whether you stayed within budget or discovered the seller’s deadline, are scored by rules. Qualitative judgement from AI is labelled and bounded so it cannot overrule the facts.</p>
              <ul className="mt-8 space-y-4 text-sm text-ink-2">
                <li className="border-l-2 border-gold pl-4">Eight scored dimensions, weighted for each scenario.</li>
                <li className="border-l-2 border-line-strong pl-4">The counterpart’s hidden limits and facts, revealed only after the game ends.</li>
                <li className="border-l-2 border-line-strong pl-4">Alternative moves at the moments that mattered, and what they would have changed.</li>
              </ul>
            </div>
            <figure className="panel p-6 shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] text-ink-3">Example debrief</p>
                  <p className="font-display text-2xl">{report.title}</p>
                  <p className="mt-1 text-sm text-ink-2">Agreed at {formatTerms([{ key: 'price', label: 'Price', unit: 'currency', min: 0, max: 1, step: 1, playerPrefers: 'lower' }], report.terms)} in {report.turns} turns</p>
                </div>
                <div className="text-right">
                  <p className="tabular font-display text-5xl text-gold">{report.evaluation.overall}</p>
                  <p className="text-[12px] text-ink-3">overall</p>
                </div>
              </div>
              <div className="gold-rule my-5" />
              <DimensionBars dims={report.evaluation.dimensions} compact />
              <figcaption className="mt-5 text-[12.5px] text-ink-3">Generated live by DealCraft’s scoring engine from a scripted practice run. It is a demonstration, not a real user’s result.</figcaption>
            </figure>
          </div>
        </section>
      )}

      {/* Progress + Classic */}
      <section className="border-t border-line bg-bg-deep/50" aria-labelledby="progress">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
          <div className="panel p-6">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-xl">Overall score by session</p>
              <p className="text-[12px] text-ink-3">Illustrative data</p>
            </div>
            <ProgressSketch />
            <p className="mt-4 text-[12.5px] text-ink-3">Your dashboard charts use only your own saved negotiations. A rising game score shows progress inside the simulator; it is not proof of real-world ability.</p>
          </div>
          <div className="flex flex-col justify-center">
            <h2 id="progress" className="display-lg">
              Track progress. Practise offline.
            </h2>
            <p className="lede mt-4">Charts follow each skill over time, by category, difficulty and mode, with tips for your weakest areas.</p>
            <p className="mt-6 text-[15px] text-ink-2">Classic mode needs no AI at all. Every scenario is fully playable with structured moves and rule-based scoring, so practice never depends on an API being available.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-line" aria-labelledby="faq">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
          <h2 id="faq" className="display-lg">
            Questions people ask first.
          </h2>
          <div className="divide-y divide-line border-y border-line">
            {FAQ_ITEMS.slice(0, 5).map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-ink">
                  {f.q}
                  <span className="text-gold transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm text-ink-2">{f.a}</p>
              </details>
            ))}
            <Link href="/faq" className="block py-4 text-sm text-gold hover:underline">
              Read all questions
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="grain relative overflow-hidden border-t border-line">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_100%,color-mix(in_oklab,var(--gold)_16%,transparent),transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
          <h2 className="display-lg">Your next negotiation is already scheduled. Rehearse it.</h2>
          <p className="lede mx-auto mt-4">Create a free account and play your first scenario in under a minute.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">Start Negotiating</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/how-it-works">See how it works</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

/** Static illustrative chart for the marketing page (clearly labelled as such). */
function ProgressSketch() {
  const pts = [42, 48, 45, 56, 61, 58, 67, 72]
  const w = 560
  const h = 180
  const x = (i: number) => 24 + (i * (w - 48)) / (pts.length - 1)
  const y = (v: number) => h - 20 - ((v - 30) / 60) * (h - 40)
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full" role="img" aria-label="Illustrative line chart of an overall score rising from 42 to 72 across eight sessions">
      {[40, 60, 80].map((v) => (
        <g key={v}>
          <line x1="24" x2={w - 24} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
          <text x="0" y={y(v) + 4} fill="var(--ink-3)" fontSize="11">
            {v}
          </text>
        </g>
      ))}
      <path d={`${d} L${x(pts.length - 1)},${h - 20} L${x(0)},${h - 20} Z`} fill="color-mix(in oklab, var(--series-1) 14%, transparent)" />
      <path d={d} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" />
      {pts.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="4" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2" />
      ))}
      <text x={x(pts.length - 1) - 4} y={y(72) - 12} fill="var(--ink)" fontSize="12" textAnchor="end">
        72
      </text>
    </svg>
  )
}
