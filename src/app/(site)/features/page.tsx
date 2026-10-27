import type { Metadata } from 'next'
import { PageIntro } from '@/components/marketing/prose'

export const metadata: Metadata = { title: 'Features' }

const GROUPS = [
  { t: 'Gameplay', items: ['AI negotiation with characters who keep their own hidden constraints', 'Classic mode with branching questions, points and structured offers; no AI needed', 'Quick two-to-five-minute rounds', 'Timed negotiations enforced by the server clock', 'Challenges with objective pass criteria', 'Replay from any move without overwriting the original', 'Custom scenarios built from your real situation'] },
  { t: 'Coaching', items: ['Eight-dimension scorecard with scenario-specific weights', 'Hidden limits and facts revealed after each game', 'Key moments and concrete alternative moves', 'Three improvement suggestions and a recommended next scenario', 'Negotiation Academy: ten short learning paths with worked examples'] },
  { t: 'Progress', items: ['Performance trend with drill-down to each debrief', 'Skill profile split between rules-only and AI-assessed games', 'Outcomes by category, agreement rate and walk-away decisions', 'Concessions over time, performance by difficulty and mode', 'Training streaks and weekly activity'] },
  { t: 'Account and privacy', items: ['Email and password sign-in with Argon2id hashing', 'Optional Google sign-in', 'Export all your data as JSON', 'Delete your account and everything in it', 'Light and dark themes'] },
]

export default function Features() {
  return (
    <>
      <PageIntro title="Everything in DealCraft">Built to make deliberate practice possible: realistic opponents, honest scoring, and a clear next step after every game.</PageIntro>
      <div className="mx-auto grid max-w-7xl gap-x-12 gap-y-14 px-4 py-16 sm:px-6 md:grid-cols-2 lg:px-8">
        {GROUPS.map((g) => (
          <section key={g.t}>
            <h2 className="font-display text-3xl">{g.t}</h2>
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {g.items.map((i) => (
                <li key={i} className="py-3 text-[15px] text-ink-2">
                  {i}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
