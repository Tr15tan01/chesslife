import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageIntro } from '@/components/marketing/prose'

export const metadata: Metadata = { title: 'How it works' }

const STEPS = [
  { t: 'Choose a scenario and a mode', d: 'Pick from career, business, buying and selling, personal, leadership and advanced situations. Play in Classic mode with structured moves, or in AI mode with free-text conversation. Add a server-enforced timer if you want pressure.' },
  { t: 'Prepare', d: 'Read your brief: your role, objectives, limits and your alternative if the deal fails. Set a target and a walk-away point for every issue, and write a short plan. Preparation is part of your score.' },
  { t: 'Negotiate with someone who has their own agenda', d: 'Each counterpart has private targets, limits, priorities and facts. They reveal more as rapport grows and as you ask the right questions. They concede over time, faster on issues they care less about, and they will walk away if pushed too hard.' },
  { t: 'Close or walk away', d: 'Accept their offer, make yours, ask for a concession on a specific issue, or leave. Sometimes no deal is the right answer, and the scoring knows it.' },
  { t: 'Read your debrief', d: 'Eight dimensions, weighted for the scenario: outcome, preparation, information gathering, offer strategy, communication, value creation, emotional control, and ethics and relationship. You also see what was hidden, the moments that mattered, and specific alternatives.' },
  { t: 'Replay and improve', d: 'Rewind to any of your moves and try something different. The original game is kept, so you can compare the two outcomes.' },
]

export default function HowItWorks() {
  return (
    <>
      <PageIntro title="How DealCraft works">A practice loop that mirrors how skilled negotiators think: prepare, discover, trade, decide, reflect.</PageIntro>
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <ol className="relative space-y-10 border-l border-line pl-8">
          {STEPS.map((s, i) => (
            <li key={s.t} className="relative">
              <span className="tabular absolute -left-[45px] top-0 grid size-7 place-items-center rounded-full bg-surface font-display text-gold ring-1 ring-line-strong">{i + 1}</span>
              <h2 className="font-display text-2xl">{s.t}</h2>
              <p className="mt-2 text-[15px] text-ink-2">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="panel mt-16 p-6">
          <h2 className="font-display text-2xl">How scoring stays honest</h2>
          <p className="mt-3 text-[15px] text-ink-2">The server computes outcomes from recorded moves: the agreed terms, whether you broke your own limits, which hidden facts you uncovered, how many concessions you made and how large they were. In AI games a separate evaluator reads the transcript and may adjust qualitative dimensions by up to 15 points, and those dimensions are labelled. Neither the browser nor the AI can change the facts.</p>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/register">Start Negotiating</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/scenarios">Explore Scenarios</Link>
          </Button>
        </div>
      </div>
    </>
  )
}
