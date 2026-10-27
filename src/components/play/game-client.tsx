'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as Tabs from '@radix-ui/react-tabs'
import { AlertTriangle, Check, CircleHelp, Clock, Flag, HandCoins, Lightbulb, LogOut, MessageSquareText, Pause, Play, Send, Sparkles, ThumbsDown, X } from 'lucide-react'
import type { GameView } from '@/lib/negotiation/view'
import { isTerminal, type Terms, type Turn } from '@/lib/negotiation/types'
import { formatTerms, formatValue } from '@/lib/negotiation/format'
import { api, ApiError, newKey } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/field'
import { Badge, Meter } from '@/components/ui/misc'
import { Dialog, DialogClose } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Avatar } from '@/components/marketing/avatar'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/use-media'
import { OfferComposer } from './offer-composer'
import { PrepForm } from './prep-form'

type Action =
  | { type: 'ASK'; questionKey: string }
  | { type: 'STATEMENT'; statementKey: string }
  | { type: 'MESSAGE'; text: string }
  | { type: 'MAKE_OFFER'; terms: Terms; message?: string }
  | { type: 'REQUEST_CONCESSION'; issueKey: string }
  | { type: 'ACCEPT' }
  | { type: 'REJECT' }
  | { type: 'WALK_AWAY' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }

const PHASE: Record<GameView['phase'], string> = { OPENING: 'Opening', EXPLORATION: 'Exploring', BARGAINING: 'Bargaining', CLOSING: 'Final offer', CLOSED: 'Closed' }

function useCountdown(view: GameView) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!view.deadlineAt) return
    // Correct for clock skew between this device and the server.
    const offset = new Date(view.serverNow).getTime() - Date.now()
    const tick = () => setNow(Date.now() + offset)
    const t = setInterval(tick, 500)
    return () => clearInterval(t)
  }, [view.deadlineAt, view.serverNow])
  if (view.pausedRemainingSec !== null) return view.pausedRemainingSec
  if (!view.deadlineAt) return null
  return Math.max(0, Math.round((new Date(view.deadlineAt).getTime() - now) / 1000))
}

function fmtClock(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function TurnBubble({ t, view }: { t: Turn; view: GameView }) {
  if (t.actor === 'system') {
    return (
      <li className="flex justify-center">
        <p className="rounded-full border border-line px-3 py-1 text-[12.5px] text-ink-3">{t.text}</p>
      </li>
    )
  }
  const mine = t.actor === 'player'
  return (
    <li className={cn('flex gap-3', mine && 'flex-row-reverse')}>
      {!mine && <Avatar name={view.scenario.counterpart.name} tone={view.scenario.counterpart.tone} size="sm" className="mt-1" />}
      <div className={cn('max-w-[min(34rem,85%)] space-y-1.5', mine && 'items-end text-right')}>
        <div className={cn('inline-block rounded-[16px] px-4 py-2.5 text-left text-[15px] leading-relaxed', mine ? 'rounded-tr-[6px] bg-gold/15 text-ink ring-1 ring-gold/30' : 'rounded-tl-[6px] bg-surface-2 text-ink ring-1 ring-line')}>
          {t.text}
        </div>
        {t.offer && (
          <div className={cn('flex', mine && 'justify-end')}>
            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12.5px]', mine ? 'border-gold/40 text-gold' : 'border-s2/50 text-s2')}>
              <HandCoins className="size-3.5" aria-hidden />
              {t.action === 'COUNTERPART_ACCEPT' ? 'Accepted: ' : t.action === 'ACCEPT' ? 'You accepted: ' : mine ? 'Your offer: ' : 'Their offer: '}
              {formatTerms(view.scenario.issues, t.offer)}
            </span>
          </div>
        )}
        {t.revealed?.map((r) => (
          <p key={r.key} className="inline-flex items-center gap-1.5 text-[12.5px] text-gold">
            <Lightbulb className="size-3.5" aria-hidden /> You learned: {r.text}
          </p>
        ))}
        {t.note && <p className="text-[12px] text-ink-3">{t.note}</p>}
        {!mine && (t.source === 'ai' || t.source === 'mock-ai') && (
          <p className="inline-flex items-center gap-1 text-[11.5px] text-ink-3">
            <Sparkles className="size-3" aria-hidden /> {t.source === 'mock-ai' ? 'Simulated AI reply (mock provider)' : 'AI-written reply'}
          </p>
        )}
      </div>
    </li>
  )
}

export function GameClient({ initial }: { initial: GameView }) {
  const router = useRouter()
  const toast = useToast()
  const [view, setView] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [aiDown, setAiDown] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [tab, setTab] = useState(initial.mode === 'AI' ? 'write' : 'ask')
  const [notes, setNotes] = useState(initial.notes)
  const [concessionIssue, setConcessionIssue] = useState(initial.scenario.issues[0]!.key)
  const listRef = useRef<HTMLOListElement>(null)
  const remaining = useCountdown(view)
  const desktop = useMediaQuery('(min-width: 1024px)')
  const s = view.scenario
  const ended = isTerminal(view.status)

  useEffect(() => {
    // Keep the newest message visible above the sticky composer.
    const list = listRef.current
    if (!list) return
    const last = list.lastElementChild as HTMLElement | null
    const composerH = (list.parentElement?.lastElementChild as HTMLElement | null)?.offsetHeight ?? 0
    if (last) window.scrollTo({ top: last.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + composerH + 24, behavior: 'smooth' })
  }, [view.turns.length, busy])

  const refresh = useCallback(async () => {
    try {
      setView(await api<GameView>(`/api/games/${view.id}`))
    } catch {
      /* ignore */
    }
  }, [view.id])

  // When the server deadline passes, fetch the authoritative (expired) result.
  useEffect(() => {
    if (!view.deadlineAt || view.status !== 'ACTIVE') return
    const ms = new Date(view.deadlineAt).getTime() - new Date(view.serverNow).getTime() + 400
    const t = setTimeout(() => void refresh(), Math.max(0, ms))
    return () => clearTimeout(t)
  }, [view.deadlineAt, view.serverNow, view.status, refresh])

  // Autosave private notes.
  useEffect(() => {
    if (notes === view.notes) return
    const t = setTimeout(() => void api(`/api/games/${view.id}/notes`, { method: 'PUT', body: { notes } }).catch(() => {}), 800)
    return () => clearTimeout(t)
  }, [notes, view.id, view.notes])

  async function act(action: Action) {
    if (busy) return
    setBusy(true)
    setAiDown(null)
    try {
      const next = await api<GameView>(`/api/games/${view.id}/actions`, { body: { action, idempotencyKey: newKey(), expectedVersion: view.version } })
      setView(next)
      if (action.type === 'MESSAGE') setText('')
      if (isTerminal(next.status)) toast('Negotiation saved. Your debrief is ready.', 'ok')
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'AI_UNAVAILABLE' || e.code === 'AI_QUOTA')) setAiDown(e.message)
      else if (e instanceof ApiError && e.status === 409) {
        toast(e.message, 'info')
        await refresh()
      } else toast(e instanceof Error ? e.message : 'That move did not go through.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  async function prep(p: { targets: Terms; walkAway: Terms; plan?: string } | null) {
    setBusy(true)
    try {
      setView(await api<GameView>(`/api/games/${view.id}/prep`, { body: p ? { ...p, skip: false } : { skip: true } }))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  async function toClassic() {
    setBusy(true)
    try {
      setView(await api<GameView>(`/api/games/${view.id}/mode`, { body: { mode: 'CLASSIC' } }))
      setAiDown(null)
      setTab('ask')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not switch modes.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  if (view.status === 'CREATED') return <PrepForm view={view} onSubmit={prep} busy={busy} />

  const offerStart: Terms = view.playerOffer ?? view.prep?.targets ?? s.brief.suggestedTargets
  const limits = view.prep?.walkAway ?? s.brief.limits
  const paused = view.status === 'PAUSED'
  const canAct = !ended && !paused && !busy

  const brief = (
    <div className="space-y-5">
      <div>
        <p className="text-[12.5px] text-ink-3">Your role</p>
        <p className="text-sm text-ink">{s.playerRole}</p>
      </div>
      <div>
        <p className="mb-1.5 text-[12.5px] text-ink-3">Objectives</p>
        <ul className="space-y-1.5 text-sm text-ink-2">
          {s.publicObjectives.map((o) => (
            <li key={o} className="flex gap-2">
              <Flag className="mt-1 size-3.5 shrink-0 text-gold" aria-hidden />
              {o}
            </li>
          ))}
        </ul>
      </div>
      <div className="overflow-hidden rounded-[12px] border border-line">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Offers on the table</caption>
          <thead className="bg-surface-2 text-ink-3">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Issue</th>
              <th className="px-3 py-2 text-right font-medium">You</th>
              <th className="px-3 py-2 text-right font-medium">Them</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {s.issues.map((i) => (
              <tr key={i.key} className="border-t border-line">
                <th scope="row" className="px-3 py-2 text-left font-normal text-ink-2">
                  {i.label}
                  <span className="block text-[11.5px] text-ink-3">
                    target {formatValue(i, view.prep?.targets[i.key] ?? s.brief.suggestedTargets[i.key])}, limit {formatValue(i, limits[i.key])}
                  </span>
                </th>
                <td className="px-3 py-2 text-right text-gold">{formatValue(i, view.playerOffer?.[i.key])}</td>
                <td className="px-3 py-2 text-right text-s2">{formatValue(i, view.counterOffer?.[i.key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-sm">
        <p className="text-[12.5px] text-ink-3">Your alternative if this fails</p>
        <p className="text-ink-2">{s.brief.batna}</p>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-[13px] text-ink-3 hover:text-ink">Context and offer history</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
          {s.brief.context.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        {view.offerHistory.length > 0 && (
          <ol className="mt-3 space-y-1 text-[12.5px] text-ink-3">
            {view.offerHistory.map((o, i) => (
              <li key={i}>
                Turn {o.turn}, {o.by === 'player' ? 'you' : 'them'}: {formatTerms(s.issues, o.terms)}
              </li>
            ))}
          </ol>
        )}
      </details>
    </div>
  )

  const side = (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-[12px] border border-line p-3">
          <p className="text-[12px] text-ink-3">Turn</p>
          <p className="tabular font-display text-2xl">
            {view.turn}
            <span className="text-base text-ink-3">/{view.maxTurns}</span>
          </p>
        </div>
        <div className="rounded-[12px] border border-line p-3">
          <p className="text-[12px] text-ink-3">{remaining !== null ? 'Time left' : 'Phase'}</p>
          <p className={cn('tabular font-display text-2xl', remaining !== null && remaining < 30 && 'text-bad')}>{remaining !== null ? fmtClock(remaining) : PHASE[view.phase]}</p>
        </div>
      </div>
      {view.rapport && (
        <div>
          <div className="flex justify-between text-[12.5px]">
            <span className="text-ink-3">Rapport</span>
            <span className="text-ink-2">{view.rapport.label}</span>
          </div>
          <Meter className="mt-1.5" value={(view.rapport.level + 1) * 25} label="Rapport" tone={view.rapport.level >= 2 ? 'ok' : view.rapport.level === 1 ? 'gold' : 'bad'} />
        </div>
      )}
      <div>
        <p className="mb-2 text-[12.5px] text-ink-3">What you have learned</p>
        {view.discovered.length === 0 ? (
          <p className="text-[13px] text-ink-3">Nothing yet. Good questions reveal hidden constraints.</p>
        ) : (
          <ul className="space-y-2">
            {view.discovered.map((d) => (
              <li key={d.key} className="flex gap-2 text-[13px] text-ink-2">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
                {d.text}
              </li>
            ))}
          </ul>
        )}
      </div>
      {!ended && (
        <div className="space-y-2">
          <p className="text-[12.5px] text-ink-3">Respond to their offer</p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={() => act({ type: 'ACCEPT' })} disabled={!canAct || !view.counterOffer}>
              <Check className="size-4" aria-hidden /> Accept
            </Button>
            <Button size="sm" variant="secondary" onClick={() => act({ type: 'REJECT' })} disabled={!canAct || !view.counterOffer}>
              <ThumbsDown className="size-4" aria-hidden /> Reject
            </Button>
          </div>
          {s.issues.length > 1 ? (
            <div className="flex gap-2">
              <select aria-label="Issue to ask a concession on" value={concessionIssue} onChange={(e) => setConcessionIssue(e.target.value)} className="h-8 min-w-0 flex-1 rounded-full border border-line bg-surface px-3 text-[13px] text-ink-2">
                {s.issues.map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.label}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="secondary" onClick={() => act({ type: 'REQUEST_CONCESSION', issueKey: concessionIssue })} disabled={!canAct || !view.counterOffer}>
                Ask for better
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" className="w-full" onClick={() => act({ type: 'REQUEST_CONCESSION', issueKey: s.issues[0]!.key })} disabled={!canAct || !view.counterOffer}>
              Ask them to do better
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button size="sm" variant="ghost" onClick={() => act({ type: paused ? 'RESUME' : 'PAUSE' })} disabled={busy}>
              {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />} {paused ? 'Resume' : 'Pause'}
            </Button>
            <Dialog
              title="Walk away from this negotiation?"
              description="The game ends with no agreement. That can be the right call when nothing on offer beats your alternative."
              trigger={
                <Button size="sm" variant="ghost" className="text-bad hover:text-bad" disabled={busy || paused}>
                  <LogOut className="size-4" aria-hidden /> Walk away
                </Button>
              }
            >
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost">Keep negotiating</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="danger" onClick={() => act({ type: 'WALK_AWAY' })}>
                    Walk away
                  </Button>
                </DialogClose>
              </div>
            </Dialog>
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="notes" className="text-[12.5px] text-ink-3">
          Private notes
        </label>
        <Textarea id="notes" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Only you can see these. Saved automatically." className="min-h-24 text-[13px]" />
      </div>
    </div>
  )

  const composer = ended ? (
    <div className="panel flex flex-col items-start gap-3 border-gold/40 p-5 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="font-display text-xl">{view.status === 'AGREEMENT_REACHED' ? 'Agreement reached' : view.status === 'WALKED_AWAY' ? 'You walked away' : view.status === 'EXPIRED' ? 'Time ran out' : 'No agreement'}</p>
        {view.outcome?.terms && <p className="text-sm text-ink-2">{formatTerms(s.issues, view.outcome.terms)}</p>}
      </div>
      <Button asChild>
        <Link href={`/results/${view.id}`}>See your debrief</Link>
      </Button>
    </div>
  ) : paused ? (
    <div className="panel flex items-center gap-3 p-5">
      <p className="flex-1 text-sm text-ink-2">Paused. {view.pausedRemainingSec !== null ? `The clock is stopped at ${fmtClock(view.pausedRemainingSec)}.` : 'Take your time.'}</p>
      <Button onClick={() => act({ type: 'RESUME' })} loading={busy}>
        Resume
      </Button>
    </div>
  ) : (
    <Tabs.Root value={tab} onValueChange={setTab} className="panel p-3 sm:p-4">
      <Tabs.List aria-label="Your move" className="mb-3 flex gap-1 overflow-x-auto">
        {(view.mode === 'CLASSIC' ? ['ask', 'say', 'offer', 'write'] : ['write', 'offer']).map((t) => (
          <Tabs.Trigger key={t} value={t} className="rounded-full px-3.5 py-1.5 text-[13px] text-ink-2 transition-colors data-[state=active]:bg-surface-3 data-[state=active]:text-ink hover:text-ink">
            {t === 'ask' ? 'Ask a question' : t === 'say' ? 'Make a point' : t === 'offer' ? 'Make an offer' : view.mode === 'AI' ? 'Message' : 'Write freely'}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value="ask" className="focus:outline-none">
        <ul className="grid gap-2 sm:grid-cols-2">
          {view.questions.map((q) => (
            <li key={q.key}>
              <button type="button" disabled={!canAct} onClick={() => act({ type: 'ASK', questionKey: q.key })} className={cn('flex h-full w-full items-start gap-2 rounded-[12px] border px-3 py-2.5 text-left text-[13.5px] transition-colors disabled:opacity-50', q.asked ? 'border-line text-ink-3' : 'border-line-strong text-ink hover:border-gold/60 hover:bg-surface-2')}>
                <CircleHelp className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                <span>
                  {q.prompt}
                  {q.asked && <span className="block text-[11.5px] text-ink-3">Already asked</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Tabs.Content>
      <Tabs.Content value="say" className="focus:outline-none">
        <ul className="grid gap-2 sm:grid-cols-2">
          {view.statements.map((st) => (
            <li key={st.key}>
              <button type="button" disabled={!canAct} onClick={() => act({ type: 'STATEMENT', statementKey: st.key })} className={cn('flex h-full w-full items-start gap-2 rounded-[12px] border px-3 py-2.5 text-left text-[13.5px] transition-colors disabled:opacity-50', st.used ? 'border-line text-ink-3' : 'border-line-strong text-ink hover:border-gold/60 hover:bg-surface-2')}>
                <MessageSquareText className={cn('mt-0.5 size-4 shrink-0', st.kind === 'pressure' || st.kind === 'bluff' ? 'text-bad' : 'text-gold')} aria-hidden />
                <span>{st.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </Tabs.Content>
      <Tabs.Content value="offer" className="focus:outline-none">
        <OfferComposer key={JSON.stringify(offerStart)} issues={s.issues} initial={offerStart} limits={limits} busy={busy} withMessage={view.mode === 'AI'} onSubmit={(terms, message) => act({ type: 'MAKE_OFFER', terms, message })} />
      </Tabs.Content>
      <Tabs.Content value="write" className="focus:outline-none">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) void act({ type: 'MESSAGE', text: text.trim() })
          }}
          className="space-y-2"
        >
          <Textarea
            aria-label="Your message"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
                e.preventDefault()
                void act({ type: 'MESSAGE', text: text.trim() })
              }
            }}
            placeholder={view.mode === 'AI' ? `Write to ${s.counterpart.name.split(' ')[0]}…` : 'Type a question or point. Classic mode matches keywords to the moves above.'}
            className="min-h-20"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-ink-3">{view.mode === 'AI' ? 'Enter to send, Shift+Enter for a new line. Use “Make an offer” for formal terms.' : 'Free text is matched by keywords only; it is not full language understanding.'}</p>
            <Button type="submit" size="sm" loading={busy} disabled={!text.trim()}>
              <Send className="size-4" aria-hidden /> Send
            </Button>
          </div>
        </form>
      </Tabs.Content>
    </Tabs.Root>
  )

  const conversation = (
    <div className="flex min-h-0 flex-col gap-4">
      <ol ref={listRef} className="space-y-4" aria-label="Conversation" aria-live="polite">
        {view.turns.map((t) => (
          <TurnBubble key={t.idx} t={t} view={view} />
        ))}
        {busy && (
          <li className="flex gap-3">
            <Avatar name={s.counterpart.name} tone={s.counterpart.tone} size="sm" />
            <span className="typing inline-flex items-center gap-1 rounded-[16px] bg-surface-2 px-4 py-3 text-ink-3" aria-label={`${s.counterpart.name} is replying`}>
              <span>●</span>
              <span>●</span>
              <span>●</span>
            </span>
          </li>
        )}
      </ol>
      {aiDown && (
        <div role="alert" className="panel flex flex-col gap-3 border-warn/50 p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="size-5 shrink-0 text-warn" aria-hidden />
          <p className="flex-1 text-sm text-ink-2">{aiDown}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setAiDown(null)}>
              <X className="size-4" aria-hidden /> Dismiss
            </Button>
            <Button size="sm" onClick={toClassic} loading={busy}>
              Continue in Classic
            </Button>
          </div>
        </div>
      )}
      <div className="sticky bottom-0 bg-gradient-to-t from-bg via-bg to-transparent pb-4 pt-4">{composer}</div>
    </div>
  )

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
        <Avatar name={s.counterpart.name} tone={s.counterpart.tone} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl">{s.title}</h1>
          <p className="truncate text-[13px] text-ink-3">
            With {s.counterpart.name}, {s.counterpart.role.toLowerCase()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={view.mode === 'AI' ? 'blue' : 'neutral'}>{view.mode === 'AI' ? 'AI negotiation' : 'Classic'}</Badge>
          {view.variant === 'REPLAY' && <Badge tone="gold">Replay</Badge>}
          {view.challenge && <Badge tone="gold">Challenge: {view.challenge.title}</Badge>}
          {remaining !== null && (
            <Badge tone={remaining < 30 ? 'bad' : 'neutral'}>
              <Clock className="size-3.5" aria-hidden /> <span className="tabular">{fmtClock(remaining)}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Desktop: three columns. Only one layout is rendered, so content and ids are never duplicated. */}
      {desktop ? (
      <div className="grid flex-1 grid-cols-[300px_1fr_300px] xl:grid-cols-[320px_1fr_320px]">
        <aside aria-label="Brief" className="border-r border-line p-5">
          <div className="sticky top-5">{brief}</div>
        </aside>
        <section aria-label="Negotiation" className="min-w-0 px-6 pt-6">
          {conversation}
        </section>
        <aside aria-label="Status and actions" className="border-l border-line p-5">
          <div className="sticky top-5">{side}</div>
        </aside>
      </div>

      ) : (
      <Tabs.Root defaultValue="talk" className="flex flex-1 flex-col">
        <Tabs.List aria-label="Game panels" className="grid grid-cols-3 border-b border-line">
          {([
            ['talk', 'Conversation'],
            ['brief', 'Brief'],
            ['side', 'Actions'],
          ] as const).map(([v, l]) => (
            <Tabs.Trigger key={v} value={v} className="border-b-2 border-transparent py-2.5 text-[13px] text-ink-2 data-[state=active]:border-gold data-[state=active]:text-ink">
              {l}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="talk" className="flex-1 px-4 pt-4">
          {conversation}
        </Tabs.Content>
        <Tabs.Content value="brief" className="p-4">
          {brief}
        </Tabs.Content>
        <Tabs.Content value="side" className="p-4">
          {side}
        </Tabs.Content>
      </Tabs.Root>
      )}
      {ended && (
        <div className="sr-only" role="status">
          Negotiation ended. <button onClick={() => router.push(`/results/${view.id}`)}>Open debrief</button>
        </div>
      )}
    </div>
  )
}
