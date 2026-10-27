'use client'

import { useMemo, useState } from 'react'
import { Search, Timer, Zap, MessagesSquare, Swords } from 'lucide-react'
import { CATEGORIES, CATEGORY_LABELS, DIFFICULTY_LABELS, STYLE_LABELS, type Category, type CounterpartStyle, type Difficulty } from '@/lib/negotiation/types'
import { Input } from '@/components/ui/field'
import { cn } from '@/lib/cn'
import { StartButton } from './start-button'
import type { ScenarioCard } from '@/server/services/scenarios'
import Link from 'next/link'

export function ScenarioPicker({ scenarios, aiAvailable, initial }: { scenarios: ScenarioCard[]; aiAvailable: boolean; initial: { mode: 'CLASSIC' | 'AI'; timed: boolean; quick: boolean } }) {
  const [mode, setMode] = useState<'CLASSIC' | 'AI'>(initial.mode === 'AI' && aiAvailable ? 'AI' : 'CLASSIC')
  const [timed, setTimed] = useState(initial.timed)
  const [quick, setQuick] = useState(initial.quick)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | 'all'>('all')
  const [diff, setDiff] = useState<number>(0)
  const list = useMemo(
    () =>
      scenarios.filter(
        (s) =>
          (cat === 'all' || s.category === cat) &&
          (!diff || s.difficulty === diff) &&
          (!quick || s.quick) &&
          (!q || `${s.title} ${s.summary} ${s.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [scenarios, cat, diff, quick, q],
  )
  return (
    <div className="space-y-6">
      <div className="panel grid gap-4 p-4 sm:p-5 lg:grid-cols-[auto_1fr] lg:items-center">
        <div role="radiogroup" aria-label="Game mode" className="inline-flex rounded-full border border-line-strong p-1">
          {(
            [
              ['CLASSIC', 'Classic', Swords],
              ['AI', 'AI negotiation', MessagesSquare],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              disabled={m === 'AI' && !aiAvailable}
              onClick={() => setMode(m)}
              className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40', mode === m ? 'bg-gold text-gold-ink' : 'text-ink-2 hover:text-ink')}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" className="size-4 accent-[var(--gold)]" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
            <Timer className="size-4 text-ink-3" aria-hidden /> Timed
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" className="size-4 accent-[var(--gold)]" checked={quick} onChange={(e) => setQuick(e.target.checked)} />
            <Zap className="size-4 text-ink-3" aria-hidden /> Quick rounds only
          </label>
        </div>
        {!aiAvailable && <p className="text-[13px] text-ink-3 lg:col-span-2">AI negotiation is not configured on this server right now. Every scenario is fully playable in Classic mode.</p>}
        {mode === 'AI' && <p className="text-[13px] text-ink-3 lg:col-span-2">In AI mode your messages are sent to the configured AI provider to write the character’s replies. Offers and limits are still decided by the scenario rules.</p>}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input aria-label="Search scenarios" placeholder="Search scenarios" className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          {(['all', ...CATEGORIES] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c} className={cn('rounded-full border px-3 py-1 text-[13px] transition-colors', cat === c ? 'border-gold bg-gold/15 text-ink' : 'border-line text-ink-2 hover:text-ink')}>
              {c === 'all' ? 'All' : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <select aria-label="Filter by difficulty" value={diff} onChange={(e) => setDiff(Number(e.target.value))} className="h-9 rounded-full border border-line bg-surface px-3 text-[13px] text-ink-2 md:ml-auto">
          <option value={0}>Any difficulty</option>
          {[1, 2, 3, 4].map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABELS[d as Difficulty]}
            </option>
          ))}
        </select>
      </div>

      {list.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-line-strong p-8 text-sm text-ink-2">No scenarios match these filters. Clear the search or choose another category.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((s) => (
            <li key={s.slug} className="panel flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[12.5px] text-ink-3">
                  {s.custom ? 'Your custom scenario' : CATEGORY_LABELS[s.category]}
                </p>
                <span className="flex gap-0.5" aria-label={`Difficulty: ${DIFFICULTY_LABELS[s.difficulty]}`}>
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} className={cn('h-1.5 w-3 rounded-full', i <= s.difficulty ? 'bg-gold' : 'bg-surface-3')} />
                  ))}
                </span>
              </div>
              <h3 className="mt-2 font-display text-[1.35rem] leading-snug">
                <Link href={`/scenarios/${s.slug}`} className="hover:text-gold-strong">
                  {s.title}
                </Link>
              </h3>
              <p className="mt-1.5 flex-1 text-sm text-ink-2">{s.summary}</p>
              <p className="mt-3 text-[12.5px] text-ink-3">
                vs {s.counterpartName}, {STYLE_LABELS[s.counterpartStyle as CounterpartStyle].toLowerCase()}. About {s.estMinutes} min{s.quick ? ', quick round' : ''}.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <StartButton size="sm" input={{ slug: s.slug, mode, timed, variant: s.custom ? 'CUSTOM' : quick || s.quick ? 'QUICK' : 'STANDARD' }}>
                  Start {mode === 'AI' ? 'AI' : 'Classic'} game
                </StartButton>
                <Link href={`/scenarios/${s.slug}`} className="text-[13px] text-ink-3 hover:text-ink">
                  Details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
