'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { api } from '@/lib/api-client'
import { tableStore } from '@/components/three/table-store'
import { cn } from '@/lib/cn'

type Preview = { turns: { actor: string; text: string; revealed: { key: string; text: string }[]; note: string | null }[]; gap: number; rapport: number }

const MOVES = [
  { id: 'why', label: 'Ask why he is selling' },
  { id: 'anchor', label: 'Offer $8,600 straight away' },
  { id: 'best', label: 'Ask for his best price' },
] as const

/**
 * A real Classic-mode move against the "Buying a used car" scenario. The
 * reply comes from the same rules engine used in the game.
 */
export function LivePreview() {
  const [picked, setPicked] = useState<string | null>(null)
  const [data, setData] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function play(move: (typeof MOVES)[number]['id']) {
    setPicked(move)
    setLoading(true)
    setError(null)
    try {
      const r = await api<Preview>('/api/preview', { body: { move } })
      setData(r)
      tableStore.set({ gap: r.gap, mood: r.rapport > 0 ? 'warm' : r.rapport < 0 ? 'cool' : 'neutral' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview unavailable.')
    } finally {
      setLoading(false)
    }
  }

  const reply = data?.turns.filter((t) => t.actor === 'counterpart').map((t) => t.text).join(' ')
  const revealed = data?.turns.flatMap((t) => t.revealed) ?? []

  return (
    <div className="glass rounded-[20px] p-5 shadow-lg sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-3">
          Try an opening move in <span className="text-ink-2">Buying a used car</span>
        </p>
        <span className="hidden items-center gap-1 text-[12px] text-ink-3 sm:inline-flex">
          <Sparkles className="size-3.5 text-gold" aria-hidden /> Live engine
        </span>
      </div>
      <div className="mt-4 flex gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-midnight text-[13px] font-semibold text-[#efe7d6] ring-1 ring-line-strong" aria-hidden>
          GH
        </div>
        <div className="min-h-[3.25rem] flex-1">
          <p className="text-[13px] font-medium text-ink-2">Gary Holt, private seller</p>
          <p className="mt-0.5 text-[15px] text-ink" aria-live="polite">
            {loading ? (
              <span className="typing inline-flex gap-1 text-ink-3" aria-label="Gary is replying">
                <span>●</span>
                <span>●</span>
                <span>●</span>
              </span>
            ) : (
              (reply ?? "She's a great car. $11,200 and honestly I've had plenty of calls.")
            )}
          </p>
          {revealed.length > 0 && <p className="mt-2 text-[13px] text-gold">You learned: {revealed.map((r) => r.text).join('; ')}.</p>}
          {error && <p className="mt-2 text-[13px] text-bad">{error}</p>}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Choose an opening move">
        {MOVES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => play(m.id)}
            disabled={loading}
            aria-pressed={picked === m.id}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
              picked === m.id ? 'border-gold bg-gold/15 text-ink' : 'border-line-strong text-ink-2 hover:border-gold/60 hover:text-ink',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      {data && (
        <p className="mt-4 text-[13px] text-ink-3">
          Every move changes what the seller reveals and how far he will move.{' '}
          <Link href="/scenarios/buy-used-car" className="text-gold hover:underline">
            Play the full scenario
          </Link>
        </p>
      )}
    </div>
  )
}
