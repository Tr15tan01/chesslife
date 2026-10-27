'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Check, CircleHelp, Handshake, Lightbulb, LogOut, MessageSquareText, Send, Sparkles, ThumbsDown } from 'lucide-react'
import type { DealView, OpponentPublic } from '@/lib/chess/types'
import { formatValue } from '@/lib/negotiation/format'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/field'
import { Badge } from '@/components/ui/misc'
import { Avatar } from '@/components/marketing/avatar'
import { cn } from '@/lib/cn'

export type DealAction =
  | { type: 'ASK'; questionKey: string }
  | { type: 'STATEMENT'; statementKey: string }
  | { type: 'MESSAGE'; text: string }
  | { type: 'MAKE_OFFER'; terms: Record<string, number> }
  | { type: 'REQUEST_CONCESSION'; issueKey: string }
  | { type: 'ACCEPT' }
  | { type: 'WALK_AWAY' }

/**
 * A deal on the table: the shared negotiation engine with a single issue.
 * Classic mode offers questions and points to make; AI mode adds free text.
 */
export function DealPanel({ deal, opponent, ai, busy, onAct }: { deal: DealView; opponent: OpponentPublic; ai: boolean; busy: boolean; onAct: (a: DealAction) => Promise<void> }) {
  const issue = deal.issue
  const values = Array.from({ length: Math.round((issue.max - issue.min) / issue.step) + 1 }, (_, i) => issue.min + i * issue.step)
  const [offer, setOffer] = useState(() => deal.playerOffer?.[issue.key] ?? (issue.playerPrefers === 'lower' ? issue.min : issue.max))
  const [text, setText] = useState('')
  const listRef = useRef<HTMLOListElement>(null)
  const ask = deal.counterOffer?.[issue.key]
  const Icon = deal.kind === 'QUEEN_TRADE' ? ArrowLeftRight : Handshake

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [deal.turns.length])

  return (
    <section className="panel overflow-hidden animate-rise" aria-label={deal.title}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-gold/15 to-transparent px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-surface ring-1 ring-gold/40 animate-[scene-pop_.6s_both]">
            <Icon className="size-4 text-gold" aria-hidden />
          </span>
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-gold">Deal on the table</p>
            <h2 className="font-display text-xl leading-tight">{deal.title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{deal.by === 'player' ? 'You asked' : 'They offered'}</Badge>
          <Badge tone={deal.rapport === 'Strained' ? 'bad' : deal.rapport === 'Warm' ? 'ok' : 'blue'}>Rapport: {deal.rapport}</Badge>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <p className="text-[14px] text-ink-2">{deal.description}</p>

        <ol ref={listRef} className="max-h-60 space-y-2.5 overflow-y-auto pr-1" aria-live="polite">
          {deal.turns.map((t) => {
            if (t.actor === 'system') return <li key={t.idx} className="text-center text-[12.5px] text-ink-3">{t.text}</li>
            const mine = t.actor === 'player'
            return (
              <li key={t.idx} className={cn('flex gap-2.5', mine && 'flex-row-reverse')}>
                {!mine && <Avatar name={opponent.name} tone={opponent.tone} size="sm" />}
                <div className={cn('max-w-[85%] space-y-1', mine && 'text-right')}>
                  <div className={cn('inline-block rounded-[14px] px-3.5 py-2 text-left text-[14.5px] leading-relaxed', mine ? 'rounded-tr-[5px] bg-gold/15 ring-1 ring-gold/30' : 'rounded-tl-[5px] bg-surface-2 ring-1 ring-line')}>{t.text}</div>
                  {t.revealed?.map((r) => (
                    <p key={r.key} className="flex items-center gap-1.5 text-[12.5px] text-gold">
                      <Lightbulb className="size-3.5" aria-hidden /> You learned: {r.text}
                    </p>
                  ))}
                  {t.note && <p className="text-[12px] text-ink-3">{t.note}</p>}
                  {!mine && (t.source === 'ai' || t.source === 'mock-ai') && (
                    <p className="flex items-center gap-1 text-[11.5px] text-ink-3">
                      <Sparkles className="size-3" aria-hidden /> {t.source === 'mock-ai' ? 'Simulated AI reply (mock provider)' : 'AI-written reply'}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        <div className="grid gap-3 rounded-[12px] border border-line bg-surface-2/50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-[12.5px] text-ink-3">{deal.finalOffer ? 'Their final offer' : 'Their current offer'}</p>
            <p className="font-display text-2xl">
              {issue.label}: {ask === undefined ? '—' : formatValue(issue, ask)}
            </p>
            {deal.finalOffer && <p className="text-[12.5px] text-warn">Final offer. Accept it, make one last offer, or walk away.</p>}
          </div>
          <Button onClick={() => void onAct({ type: 'ACCEPT' })} disabled={busy || ask === undefined}>
            <Check className="size-4" aria-hidden /> Accept
          </Button>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-2">Your offer · {issue.label.toLowerCase()}</p>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label={issue.label} className="inline-flex flex-wrap gap-1.5">
              {values.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={offer === v}
                  onClick={() => setOffer(v)}
                  className={cn('rounded-full border px-3.5 py-1.5 text-[13.5px] transition-colors', offer === v ? 'border-gold bg-gold text-gold-ink' : 'border-line-strong text-ink-2 hover:border-gold/60 hover:text-ink')}
                >
                  {formatValue(issue, v)}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={() => void onAct({ type: 'MAKE_OFFER', terms: { [issue.key]: offer } })} loading={busy}>
              <Send className="size-3.5" aria-hidden /> Propose
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void onAct({ type: 'REQUEST_CONCESSION', issueKey: issue.key })} disabled={busy}>
              <ThumbsDown className="size-3.5" aria-hidden /> Can you do better?
            </Button>
          </div>
        </div>

        {deal.discovered.length > 0 && (
          <ul className="space-y-1">
            {deal.discovered.map((d) => (
              <li key={d.key} className="flex items-center gap-1.5 text-[13px] text-gold">
                <Lightbulb className="size-3.5" aria-hidden /> {d.text}
              </li>
            ))}
          </ul>
        )}

        {ai ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!text.trim()) return
              void onAct({ type: 'MESSAGE', text: text.trim() }).then(() => setText(''))
            }}
          >
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1000} placeholder={`Say something to ${opponent.name.split(' ')[0]}…`} aria-label="Message" className="min-h-0 flex-1" />
            <Button type="submit" size="sm" loading={busy} disabled={!text.trim()}>
              <MessageSquareText className="size-3.5" aria-hidden /> Send
            </Button>
          </form>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[12.5px] font-medium text-ink-3">Ask</p>
              <div className="flex flex-col gap-1.5">
                {deal.questions.map((q) => (
                  <button key={q.key} type="button" disabled={busy || q.asked} onClick={() => void onAct({ type: 'ASK', questionKey: q.key })} className="flex items-start gap-2 rounded-[10px] border border-line px-3 py-2 text-left text-[13.5px] transition-colors hover:border-gold/50 disabled:opacity-45">
                    <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden /> {q.prompt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[12.5px] font-medium text-ink-3">Say</p>
              <div className="flex flex-col gap-1.5">
                {deal.statements.map((s) => (
                  <button key={s.key} type="button" disabled={busy || s.used} onClick={() => void onAct({ type: 'STATEMENT', statementKey: s.key })} className="flex items-start gap-2 rounded-[10px] border border-line px-3 py-2 text-left text-[13.5px] transition-colors hover:border-gold/50 disabled:opacity-45">
                    <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden /> {s.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end border-t border-line pt-3">
          <Button variant="ghost" size="sm" onClick={() => void onAct({ type: 'WALK_AWAY' })} disabled={busy}>
            <LogOut className="size-3.5" aria-hidden /> {deal.by === 'player' ? 'Never mind, play on' : 'No thanks, play on'}
          </Button>
        </div>
      </div>
    </section>
  )
}
