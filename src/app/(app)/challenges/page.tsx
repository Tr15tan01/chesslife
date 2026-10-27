import type { Metadata } from 'next'
import { CheckCircle2, Lock } from 'lucide-react'
import { PageHeader } from '@/components/app/app-shell'
import { Badge } from '@/components/ui/misc'
import { StartButton } from '@/components/play/start-button'
import { DIFFICULTY_LABELS, type Difficulty } from '@/lib/negotiation/types'
import { requireUser } from '@/server/auth/guard'
import { listChallenges } from '@/server/services/training'
import { cn } from '@/lib/cn'

export const metadata: Metadata = { title: 'Challenges' }

export default async function ChallengesPage() {
  const user = await requireUser()
  const challenges = await listChallenges(user.id)
  const passed = challenges.filter((c) => c.passed).length
  return (
    <div className="pb-16">
      <PageHeader title="Challenges" description={`Objective goals in increasingly difficult scenarios. Pass one to unlock the next. ${passed} of ${challenges.length} passed.`} />
      <ol className="space-y-3 px-4 pt-6 sm:px-8">
        {challenges.map((c) => (
          <li key={c.slug} className={cn('panel flex flex-col gap-4 p-5 md:flex-row md:items-center', !c.unlocked && 'opacity-60')}>
            <span className="tabular font-display text-3xl leading-none text-gold md:w-10">{c.order}</span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl">{c.title}</h2>
                {c.passed && (
                  <Badge tone="ok">
                    <CheckCircle2 className="size-3" aria-hidden /> Passed
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-ink-2">
                {c.summary} In <span className="text-ink">{c.scenario?.title}</span>
                {c.scenario ? `, ${DIFFICULTY_LABELS[c.scenario.difficulty as Difficulty].toLowerCase()}.` : '.'}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {c.criteriaText.map((t) => (
                  <li key={t} className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink-3">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            {c.unlocked ? (
              <StartButton variant={c.passed ? 'secondary' : 'primary'} input={{ slug: c.scenario?.slug ?? 'ask-for-a-raise', mode: 'CLASSIC', variant: 'CHALLENGE', challengeSlug: c.slug }}>
                {c.passed ? 'Try again' : 'Take the challenge'}
              </StartButton>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm text-ink-3">
                <Lock className="size-4" aria-hidden /> Pass the previous challenge
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
