'use client'

import { useState } from 'react'
import type { Issue, Terms } from '@/lib/negotiation/types'
import { formatValue, roundToStep } from '@/lib/negotiation/format'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/field'

export function IssueSlider({ issue, value, onChange, limit, label }: { issue: Issue; value: number; onChange: (v: number) => void; limit?: number; label?: string }) {
  const pct = (v: number) => ((v - issue.min) / (issue.max - issue.min)) * 100
  const id = `issue-${issue.key}-${label ?? 'v'}`
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] text-ink-2">
          {label ?? issue.label}
        </label>
        <span className="tabular text-[15px] font-medium text-ink">{formatValue(issue, value)}</span>
      </div>
      <div className="relative mt-2">
        <input
          id={id}
          type="range"
          min={issue.min}
          max={issue.max}
          step={issue.step}
          value={value}
          onChange={(e) => onChange(roundToStep(issue, Number(e.target.value)))}
          className="w-full accent-[var(--gold)]"
          aria-valuetext={formatValue(issue, value)}
        />
        {limit !== undefined && (
          <span className="pointer-events-none absolute -bottom-1 h-2 w-px bg-bad" style={{ left: `${pct(limit)}%` }} title="Your limit" aria-hidden />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11.5px] text-ink-3">
        <span>{formatValue(issue, issue.min)}</span>
        {issue.hint && <span className="hidden sm:inline">{issue.hint}</span>}
        <span>{formatValue(issue, issue.max)}</span>
      </div>
    </div>
  )
}

export function OfferComposer({ issues, initial, limits, onSubmit, busy, withMessage }: { issues: Issue[]; initial: Terms; limits: Terms; onSubmit: (terms: Terms, message?: string) => void; busy: boolean; withMessage: boolean }) {
  const [terms, setTerms] = useState<Terms>(initial)
  const [message, setMessage] = useState('')
  const breaches = issues.filter((i) => {
    const v = terms[i.key]!
    const l = limits[i.key]!
    return i.playerPrefers === 'higher' ? v < l : v > l
  })
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(terms, withMessage && message.trim() ? message.trim() : undefined)
      }}
    >
      {issues.map((i) => (
        <IssueSlider key={i.key} issue={i} value={terms[i.key]!} limit={limits[i.key]} onChange={(v) => setTerms((t) => ({ ...t, [i.key]: v }))} />
      ))}
      {withMessage && <Textarea aria-label="Message with your offer (optional)" placeholder="Add a reason (optional). Offers with reasons land better." value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} className="min-h-16" />}
      {breaches.length > 0 && <p className="text-[13px] text-bad">This offer is past your own limit on {breaches.map((b) => b.label.toLowerCase()).join(', ')}.</p>}
      <Button type="submit" loading={busy} className="w-full sm:w-auto">
        Make this offer
      </Button>
    </form>
  )
}
