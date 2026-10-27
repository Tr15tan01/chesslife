import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'
import { PageHeader } from '@/components/app/app-shell'
import { Meter } from '@/components/ui/misc'
import { DIMENSION_LABELS, type Dimension } from '@/lib/negotiation/types'
import { requireUser } from '@/server/auth/guard'
import { listPrograms } from '@/server/services/training'

export const metadata: Metadata = { title: 'Negotiation Academy' }

export default async function TrainingPage() {
  const user = await requireUser()
  const programs = await listPrograms(user.id)
  const done = programs.reduce((n, p) => n + p.completed, 0)
  const total = programs.reduce((n, p) => n + p.lessons.length, 0)
  return (
    <div className="pb-16">
      <PageHeader title="Negotiation Academy" description={`Short lessons built around one idea, a worked example and a scenario to practise it. ${done} of ${total} lessons complete.`} />
      <ol className="grid gap-4 px-4 pt-6 sm:px-8 lg:grid-cols-2">
        {programs.map((p) => (
          <li key={p.slug} className="panel flex flex-col p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="tabular font-display text-3xl leading-none text-gold">{p.order}</span>
              <div className="flex-1">
                <h2 className="font-display text-[1.4rem]">{p.title}</h2>
                <p className="mt-1 text-sm text-ink-2">{p.summary}</p>
                <p className="mt-1 text-[12.5px] text-ink-3">Builds: {DIMENSION_LABELS[p.skill as Dimension]?.toLowerCase() ?? p.skill}</p>
              </div>
            </div>
            <Meter className="mt-5" value={p.lessons.length ? (p.completed / p.lessons.length) * 100 : 0} label={`${p.title} progress`} tone="ok" />
            <ul className="mt-4 space-y-1.5">
              {p.lessons.map((l) => (
                <li key={l.slug}>
                  <Link href={`/training/${l.slug}`} className="group flex items-center gap-3 rounded-[10px] px-2 py-1.5 text-sm hover:bg-surface-2">
                    {l.done ? <CheckCircle2 className="size-4 text-ok" aria-label="Completed" /> : <Circle className="size-4 text-ink-3" aria-label="Not started" />}
                    <span className="flex-1 text-ink group-hover:text-gold-strong">{l.title}</span>
                    <span className="text-[12px] text-ink-3">{l.minutes} min</span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}
