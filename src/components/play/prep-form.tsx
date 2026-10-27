'use client'

import { useState } from 'react'
import { Target, ShieldAlert } from 'lucide-react'
import type { GameView } from '@/lib/negotiation/view'
import type { Terms } from '@/lib/negotiation/types'
import { formatValue } from '@/lib/negotiation/format'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/field'
import { IssueSlider } from './offer-composer'
import { Avatar } from '@/components/marketing/avatar'

/** Preparation step: targets, walk-away points and a short plan. */
export function PrepForm({ view, onSubmit, busy }: { view: GameView; onSubmit: (prep: { targets: Terms; walkAway: Terms; plan?: string } | null) => void; busy: boolean }) {
  const s = view.scenario
  const [targets, setTargets] = useState<Terms>({ ...s.brief.suggestedTargets })
  const [walkAway, setWalkAway] = useState<Terms>({ ...s.brief.limits })
  const [plan, setPlan] = useState('')
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
      <section className="space-y-6">
        <div>
          <p className="text-[13px] text-ink-3">Preparation</p>
          <h1 className="display-lg mt-1">{s.title}</h1>
          <p className="mt-3 text-[15px] text-ink-2">{s.description}</p>
        </div>
        <div className="panel space-y-4 p-5">
          <div className="flex items-center gap-3">
            <Avatar name={s.counterpart.name} tone={s.counterpart.tone} />
            <div>
              <p className="font-medium text-ink">{s.counterpart.name}</p>
              <p className="text-[13px] text-ink-3">{s.counterpart.role}</p>
            </div>
          </div>
          <p className="text-sm text-ink-2">{s.counterpart.bio}</p>
        </div>
        <div className="panel space-y-3 p-5 text-sm">
          <p className="font-medium text-ink">You are: {s.playerRole}</p>
          <ul className="list-disc space-y-1 pl-5 text-ink-2">
            {s.brief.context.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="text-ink-2">
            <span className="text-ink">Your alternative: </span>
            {s.brief.batna}
          </p>
          <div>
            <p className="text-ink">Objectives</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-2">
              {s.publicObjectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="panel space-y-6 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-2xl">Set your numbers</h2>
          <p className="mt-1 text-sm text-ink-2">Decide now, while you are calm. Preparation is scored, and your targets appear beside the conversation.</p>
        </div>
        {s.issues.map((i) => (
          <div key={i.key} className="space-y-4 rounded-[12px] border border-line p-4">
            <p className="text-sm font-medium text-ink">
              {i.label} <span className="text-[12.5px] font-normal text-ink-3">(your hard limit: {formatValue(i, s.brief.limits[i.key])})</span>
            </p>
            <IssueSlider issue={i} label="Target" value={targets[i.key]!} onChange={(v) => setTargets((t) => ({ ...t, [i.key]: v }))} />
            <IssueSlider issue={i} label="Walk-away point" value={walkAway[i.key]!} limit={s.brief.limits[i.key]} onChange={(v) => setWalkAway((t) => ({ ...t, [i.key]: v }))} />
          </div>
        ))}
        <div className="space-y-1.5">
          <label htmlFor="plan" className="text-[13px] font-medium text-ink-2">
            Your plan
          </label>
          <Textarea id="plan" placeholder="What will you ask first? What could you trade? When would you walk away?" value={plan} maxLength={1000} onChange={(e) => setPlan(e.target.value)} />
        </div>
        <ul className="space-y-2 text-[13px] text-ink-3">
          <li className="flex gap-2">
            <Target className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden /> {s.learningObjective}
          </li>
          {view.timeLimitSec && (
            <li className="flex gap-2">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden /> The {Math.round(view.timeLimitSec / 60)}-minute clock starts when you begin.
            </li>
          )}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => onSubmit({ targets, walkAway, plan: plan.trim() || undefined })} loading={busy}>
            Begin negotiation
          </Button>
          <Button variant="ghost" onClick={() => onSubmit(null)} disabled={busy}>
            Skip preparation
          </Button>
        </div>
      </section>
    </div>
  )
}
