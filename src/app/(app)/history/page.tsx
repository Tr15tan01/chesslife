import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/app/app-shell'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { StatusBadge, relativeDate } from '@/components/app/status'
import { CATEGORY_LABELS, isTerminal, type Category } from '@/lib/negotiation/types'
import { cn } from '@/lib/cn'
import { requireUser } from '@/server/auth/guard'
import { historyQuerySchema, listHistory } from '@/server/services/games'

export const metadata: Metadata = { title: 'History' }

const VARIANT: Record<string, string> = { STANDARD: 'Standard', QUICK: 'Quick', CHALLENGE: 'Challenge', ACADEMY: 'Academy', REPLAY: 'Replay', CUSTOM: 'Custom' }

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser()
  const parsed = historyQuerySchema.safeParse(await searchParams)
  const q = parsed.success ? parsed.data : historyQuerySchema.parse({})
  const { items, total, pageSize } = await listHistory(user.id, q)
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const href = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...q, ...patch })) if (v !== undefined) p.set(k, String(v))
    return `/history?${p.toString()}`
  }
  return (
    <div className="pb-16">
      <PageHeader title="History" description="Every negotiation you have played. Open a finished one to review the transcript or replay from any move." />
      <div className="space-y-4 px-4 pt-6 sm:px-8">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status filter">
          {(['all', 'completed', 'active'] as const).map((s) => (
            <Link key={s} href={href({ status: s, page: 1 })} className={cn('rounded-full border px-3 py-1 text-[13px]', q.status === s ? 'border-gold bg-gold/15 text-ink' : 'border-line text-ink-2 hover:text-ink')}>
              {s === 'all' ? 'All' : s === 'completed' ? 'Completed' : 'In progress'}
            </Link>
          ))}
        </div>
        {items.length === 0 ? (
          <EmptyState title="Nothing here yet" action={<Button asChild size="sm"><Link href="/play">Start a negotiation</Link></Button>}>
            Your negotiations will be listed here as you play.
          </EmptyState>
        ) : (
          <div className="panel overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line text-left text-[12.5px] text-ink-3">
                <tr>
                  <th className="px-5 py-3 font-medium">Scenario</th>
                  <th className="px-3 py-3 font-medium">Mode</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Played</th>
                  <th className="px-5 py-3 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {items.map((g) => (
                  <tr key={g.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/50">
                    <td className="px-5 py-3">
                      <Link href={isTerminal(g.status) ? `/results/${g.id}` : `/play/${g.id}`} className="text-ink hover:text-gold-strong">
                        {g.scenarioTitle}
                      </Link>
                      <span className="block text-[12px] text-ink-3">{CATEGORY_LABELS[g.category as Category] ?? g.category}</span>
                    </td>
                    <td className="px-3 py-3 text-ink-2">
                      {g.mode === 'AI' ? 'AI' : 'Classic'}, {VARIANT[g.variant]?.toLowerCase()}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={g.status} />
                    </td>
                    <td className="px-3 py-3 text-ink-3">{relativeDate(g.createdAt)}</td>
                    <td className="tabular px-5 py-3 text-right font-display text-lg">{g.score ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
            {q.page > 1 ? <Link href={href({ page: q.page - 1 })} className="text-gold hover:underline">Previous</Link> : <span />}
            <span className="text-ink-3">
              Page {q.page} of {pages}
            </span>
            {q.page < pages ? <Link href={href({ page: q.page + 1 })} className="text-gold hover:underline">Next</Link> : <span />}
          </nav>
        )}
      </div>
    </div>
  )
}
