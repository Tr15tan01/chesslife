'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Crown, Shuffle, Sparkles } from 'lucide-react'
import { LIFE_AREAS, PIECE_NAMES, type ChessHistoryItem, type OpponentPublic, type PieceType } from '@/lib/chess/types'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Badge, Panel, PanelTitle } from '@/components/ui/misc'
import { useToast } from '@/components/ui/toast'
import { Avatar } from '@/components/marketing/avatar'
import { cn } from '@/lib/cn'

const GLYPH: Record<PieceType, string> = { k: '♚︎', q: '♛︎', r: '♜︎', b: '♝︎', n: '♞︎', p: '♟︎' }
const STATUS_LABEL = { ACTIVE: 'In progress', WON: 'Won', LOST: 'Lost', DRAWN: 'Draw' } as const

export function ChessLobby({ opponents, aiAvailable, recent }: { opponents: OpponentPublic[]; aiAvailable: boolean; recent: ChessHistoryItem[] }) {
  const router = useRouter()
  const toast = useToast()
  const [opponent, setOpponent] = useState(opponents[0]!.key)
  const [color, setColor] = useState<'w' | 'b' | 'random'>('w')
  const [ai, setAi] = useState(false)
  const [loading, setLoading] = useState(false)

  const start = async () => {
    setLoading(true)
    try {
      const r = await api<{ id: string }>('/api/chess', { body: { opponent, color, mode: ai && aiAvailable ? 'AI' : 'CLASSIC' } })
      router.push(`/play/chess/${r.id}`)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.push('/login?next=/play/chess')
      else toast(e instanceof Error ? e.message : 'Could not start the game.', 'bad')
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <Panel>
          <PanelTitle>Choose your opponent</PanelTitle>
          <div role="radiogroup" aria-label="Opponent" className="grid gap-3 md:grid-cols-3">
            {opponents.map((o) => (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={opponent === o.key}
                onClick={() => setOpponent(o.key)}
                className={cn(
                  'flex flex-col items-start gap-3 rounded-[14px] border p-4 text-left transition-[border,background,transform] hover:-translate-y-0.5',
                  opponent === o.key ? 'border-gold bg-gold/10' : 'border-line-strong bg-surface-2/40 hover:border-gold/50',
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <Avatar name={o.name} tone={o.tone} />
                  <Badge tone={o.level === 1 ? 'ok' : o.level === 2 ? 'blue' : 'gold'}>{o.levelLabel}</Badge>
                </div>
                <div>
                  <p className="font-display text-lg leading-tight">{o.name}</p>
                  <p className="text-[13px] text-ink-3">{o.role}</p>
                </div>
                <p className="text-[13.5px] text-ink-2">{o.bio}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-2">Play as</p>
              <div role="radiogroup" aria-label="Your colour" className="inline-flex rounded-full border border-line-strong p-1">
                {(
                  [
                    ['w', 'White'],
                    ['b', 'Black'],
                    ['random', 'Random'],
                  ] as const
                ).map(([c, label]) => (
                  <button key={c} type="button" role="radio" aria-checked={color === c} onClick={() => setColor(c)} className={cn('inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] transition-colors', color === c ? 'bg-gold text-gold-ink' : 'text-ink-2 hover:text-ink')}>
                    {c === 'random' && <Shuffle className="size-3.5" aria-hidden />}
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-2">Narration</p>
              <label className={cn('flex items-start gap-3 text-[14px]', !aiAvailable && 'opacity-60')}>
                <input type="checkbox" role="switch" className="mt-1 size-5 accent-[var(--gold)]" checked={ai && aiAvailable} disabled={!aiAvailable} onChange={(e) => setAi(e.target.checked)} />
                <span>
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Sparkles className="size-3.5 text-gold" aria-hidden /> AI mode
                  </span>
                  <span className="block text-[13px] text-ink-3">{aiAvailable ? 'Your opponent comments in their own words and personalises each life scene. The moves are always played by the chess engine.' : 'AI is not configured on this server. Classic mode is fully playable.'}</span>
                </span>
              </label>
            </div>
          </div>
          <Button size="lg" className="mt-6" onClick={() => void start()} loading={loading}>
            <Crown className="size-4" aria-hidden /> Start Life Chess
          </Button>
        </Panel>

        {recent.length > 0 && (
          <Panel>
            <PanelTitle>Recent games</PanelTitle>
            <ul className="divide-y divide-line">
              {recent.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                  <span>
                    vs {g.opponent} <span className="text-ink-3">· {g.moves} moves{g.mode === 'AI' ? ' · AI' : ''}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <Badge tone={g.status === 'WON' ? 'ok' : g.status === 'LOST' ? 'bad' : g.status === 'DRAWN' ? 'blue' : 'gold'}>{STATUS_LABEL[g.status]}</Badge>
                    <Link href={`/play/chess/${g.id}`} className="text-gold hover:underline">
                      {g.status === 'ACTIVE' ? 'Resume' : 'View'}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      <Panel as="aside">
        <PanelTitle>Your pieces, your life</PanelTitle>
        <ul className="space-y-3.5">
          {(['k', 'q', 'r', 'b', 'n', 'p'] as const).map((t) => (
            <li key={t} className="flex gap-3">
              <span className="w-8 shrink-0 text-center text-[1.8rem] leading-none text-ink [-webkit-text-stroke:1px_var(--gold)]" aria-hidden>
                {GLYPH[t]}
              </span>
              <span>
                <span className="font-medium">{LIFE_AREAS[t].area}</span> <span className="text-[13px] text-ink-3">· {PIECE_NAMES[t]}</span>
                <span className="block text-[13.5px] text-ink-2">{LIFE_AREAS[t].meaning}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-line pt-4 text-[13.5px] text-ink-2">Key moves open a short life scene: a negotiation, a setback, a big win. How you respond never changes the board. It is a chance to think about the move off the board too.</p>
      </Panel>
    </div>
  )
}
