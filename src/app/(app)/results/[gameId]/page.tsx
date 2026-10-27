import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CheckCircle2, CircleDashed, Lightbulb, Sparkles, Target, TriangleAlert, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Panel, PanelTitle } from '@/components/ui/misc'
import { DimensionBars } from '@/components/results/dimension-bars'
import { ReplayButton } from '@/components/results/replay-list'
import { StatusBadge } from '@/components/app/status'
import { StartButton } from '@/components/play/start-button'
import { formatTerms, formatValue } from '@/lib/negotiation/format'
import { isTerminal } from '@/lib/negotiation/types'
import { requireUser } from '@/server/auth/guard'
import { getGameView } from '@/server/services/games'
import { getEvaluation } from '@/server/services/completion'
import { AppError } from '@/server/http'
import { cn } from '@/lib/cn'

export const metadata: Metadata = { title: 'Debrief' }

export default async function ResultsPage({ params }: { params: Promise<{ gameId: string }> }) {
  const user = await requireUser()
  const { gameId } = await params
  let game
  try {
    game = await getGameView(user, gameId)
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound()
    throw e
  }
  if (!isTerminal(game.status)) redirect(`/play/${gameId}`)
  const ev = await getEvaluation(user.id, gameId)
  if (!ev) notFound()
  const s = game.scenario
  const snapshotByTurn = new Map(game.snapshots.map((sn, i) => [sn.turnIdx, i]))

  return (
    <div className="pb-20">
      <header className="grain relative overflow-hidden border-b border-line">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_80%_at_85%_0%,color-mix(in_oklab,var(--gold)_14%,transparent),transparent_70%)]" />
        <div className="relative grid gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={game.status} />
              <Badge>{game.mode === 'AI' ? 'AI negotiation' : 'Classic'}</Badge>
              {game.variant === 'REPLAY' && <Badge tone="gold">Replay</Badge>}
              {ev.aiAssessed && (
                <Badge tone="blue">
                  <Sparkles className="size-3" aria-hidden /> Includes AI assessment
                </Badge>
              )}
            </div>
            <h1 className="display-lg mt-4">{s.title}</h1>
            <p className="mt-2 text-[15px] text-ink-2">
              {ev.facts.agreement ? `Agreed: ${formatTerms(s.issues, ev.facts.agreement)}.` : 'No agreement.'} {ev.facts.turns} {ev.facts.turns === 1 ? 'turn' : 'turns'}, {ev.facts.offersMade} {ev.facts.offersMade === 1 ? 'offer' : 'offers'} from you, {ev.facts.concessions} {ev.facts.concessions === 1 ? 'concession' : 'concessions'}.
            </p>
            {ev.facts.respectedOwnLimit === false && <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-bad"><TriangleAlert className="size-4" aria-hidden /> These terms broke your own limit.</p>}
          </div>
          <div className="flex items-end gap-4 lg:flex-col lg:items-end">
            <div className="text-right">
              <p className="tabular font-display text-7xl leading-none text-gold">{ev.overall}</p>
              <p className="mt-1 text-[13px] text-ink-3">Overall, out of 100</p>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-6 px-4 pt-6 sm:px-8">
        {ev.challenge && (
          <Panel className={cn(ev.challenge.passed ? 'border-ok/50' : 'border-bad/40')}>
            <PanelTitle>{ev.challenge.passed ? `Challenge passed: ${ev.challenge.title}` : `Challenge not passed: ${ev.challenge.title}`}</PanelTitle>
            <ul className="grid gap-2 sm:grid-cols-2">
              {ev.challenge.criteria.map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-sm text-ink-2">
                  {c.met ? <CheckCircle2 className="size-4 text-ok" aria-hidden /> : <XCircle className="size-4 text-bad" aria-hidden />}
                  {c.label}
                  <span className="sr-only">{c.met ? ' (met)' : ' (not met)'}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          <Panel>
            <PanelTitle>Scorecard</PanelTitle>
            <DimensionBars dims={ev.dimensions} showRationale />
            <p className="mt-5 text-[12.5px] text-ink-3">
              Outcome, preparation and offer strategy are always scored by rules from what happened. {ev.aiAssessed ? 'Dimensions marked “AI-assessed” blend a rules score with an AI judgement, limited to 15 points either way.' : 'This game was scored entirely by rules.'}
            </p>
          </Panel>
          <div className="space-y-6">
            <Panel>
              <PanelTitle>What to change next time</PanelTitle>
              <ol className="space-y-3">
                {ev.suggestions.map((t, i) => (
                  <li key={t} className="flex gap-3 text-sm text-ink-2">
                    <span className="tabular font-display text-xl leading-none text-gold">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
              <p className="mt-5 flex gap-2 rounded-[12px] bg-surface-2 p-3 text-sm text-ink">
                <Target className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                {ev.takeaway}
              </p>
            </Panel>
            <Panel>
              <PanelTitle>Strengths</PanelTitle>
              <ul className="space-y-2 text-sm text-ink-2">
                {ev.strengths.map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              {ev.missed.length > 0 && (
                <>
                  <h3 className="mt-5 font-sans text-sm font-semibold text-ink">Missed opportunities</h3>
                  <ul className="mt-2 space-y-2 text-sm text-ink-2">
                    {ev.missed.map((t) => (
                      <li key={t} className="flex gap-2">
                        <CircleDashed className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                        {t}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelTitle>What was hidden</PanelTitle>
            <div className="overflow-hidden rounded-[12px] border border-line">
              <table className="w-full text-[13px]">
                <thead className="bg-surface-2 text-ink-3">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Issue</th>
                    <th className="px-3 py-2 text-right font-medium">Their target</th>
                    <th className="px-3 py-2 text-right font-medium">Their limit</th>
                    <th className="px-3 py-2 text-right font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {s.issues.map((i) => (
                    <tr key={i.key} className="border-t border-line">
                      <th scope="row" className="px-3 py-2 text-left font-normal text-ink-2">{i.label}</th>
                      <td className="px-3 py-2 text-right text-ink-2">{formatValue(i, ev.revealed.counterpartTargets[i.key])}</td>
                      <td className="px-3 py-2 text-right text-s2">{formatValue(i, ev.revealed.counterpartLimits[i.key])}</td>
                      <td className="px-3 py-2 text-right text-gold">{formatValue(i, ev.facts.agreement?.[i.key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-4 space-y-2">
              {ev.revealed.hiddenFacts.map((f) => (
                <li key={f.key} className="flex gap-2 text-sm">
                  {f.discovered ? <Lightbulb className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />}
                  <span className={f.discovered ? 'text-ink' : 'text-ink-3'}>
                    {f.text}
                    <span className="ml-2 text-[12px] text-ink-3">{f.discovered ? 'you found this' : 'not discovered'}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[13px] text-ink-3">{ev.revealed.notes}</p>
            {!ev.facts.zopaExisted && <p className="mt-3 text-sm text-gold">There was no deal available that beat your alternative. Walking away was the strongest result.</p>}
          </Panel>
          <Panel>
            <PanelTitle>Moments and alternatives</PanelTitle>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {ev.moments.map((m, i) => (
                <li key={i} className="relative">
                  <span className={cn('absolute -left-[26px] top-1.5 size-2.5 rounded-full ring-4 ring-surface', m.tone === 'good' ? 'bg-ok' : m.tone === 'missed' ? 'bg-warn' : 'bg-ink-3')} aria-hidden />
                  <p className="text-sm font-medium text-ink">{m.title}</p>
                  <p className="text-[13px] text-ink-2">{m.detail}</p>
                </li>
              ))}
            </ol>
            {ev.alternatives.length > 0 && (
              <div className="mt-6 space-y-3">
                {ev.alternatives.map((a, i) => (
                  <div key={i} className="rounded-[12px] border border-line p-3 text-sm">
                    <p className="text-ink-3">Instead of: {a.instead}</p>
                    <p className="mt-1 text-ink">Try: “{a.try}”</p>
                    <p className="mt-1 text-[13px] text-ink-2">{a.consequence}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <Panel>
          <PanelTitle>Transcript</PanelTitle>
          <ol className="space-y-3">
            {game.turns.map((t) => (
              <li key={t.idx} className={cn('grid gap-1 rounded-[12px] px-3 py-2 sm:grid-cols-[120px_1fr_auto] sm:items-start sm:gap-4', t.actor === 'player' ? 'bg-gold/5' : '')}>
                <span className="text-[12.5px] text-ink-3">{t.actor === 'player' ? 'You' : t.actor === 'counterpart' ? s.counterpart.name : 'System'}</span>
                <span className="text-sm text-ink-2">
                  {t.text}
                  {t.offer && <span className="ml-2 text-[12.5px] text-gold">[{formatTerms(s.issues, t.offer)}]</span>}
                  {t.revealed?.map((r) => (
                    <span key={r.key} className="mt-1 block text-[12.5px] text-gold">
                      Learned: {r.text}
                    </span>
                  ))}
                </span>
                {snapshotByTurn.has(t.idx) && <ReplayButton gameId={game.id} snapshot={snapshotByTurn.get(t.idx)!} label={t.text.slice(0, 60)} />}
              </li>
            ))}
          </ol>
        </Panel>

        <div className="flex flex-wrap items-center gap-3">
          <StartButton input={{ slug: s.slug, mode: game.mode === 'AI' && game.aiAvailable ? 'AI' : 'CLASSIC' }}>Play this scenario again</StartButton>
          {ev.recommended && (
            <Button asChild variant="secondary">
              <Link href={`/scenarios/${ev.recommended.slug}`}>Next: {ev.recommended.title}</Link>
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
        {ev.recommended && <p className="text-[13px] text-ink-3">{ev.recommended.reason}</p>}
      </div>
    </div>
  )
}
