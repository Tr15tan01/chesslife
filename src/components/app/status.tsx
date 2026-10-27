import type { GameStatus } from '@/lib/negotiation/types'
import { Badge } from '@/components/ui/misc'

const MAP: Record<GameStatus, { label: string; tone: 'neutral' | 'gold' | 'ok' | 'bad' | 'warn' | 'blue' }> = {
  CREATED: { label: 'Preparing', tone: 'neutral' },
  ACTIVE: { label: 'In progress', tone: 'gold' },
  PAUSED: { label: 'Paused', tone: 'warn' },
  AGREEMENT_REACHED: { label: 'Agreement', tone: 'ok' },
  WALKED_AWAY: { label: 'Walked away', tone: 'blue' },
  FAILED: { label: 'No deal', tone: 'bad' },
  EXPIRED: { label: 'Time ran out', tone: 'bad' },
}

export function StatusBadge({ status }: { status: GameStatus }) {
  const m = MAP[status]
  return <Badge tone={m.tone}>{m.label}</Badge>
}

export function ModeLabel({ mode }: { mode: 'CLASSIC' | 'AI' }) {
  return <span className="text-[12.5px] text-ink-3">{mode === 'AI' ? 'AI' : 'Classic'}</span>
}

export function relativeDate(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const day = 86400000
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.round(diff / 60000)} min ago`
  if (diff < day) return `${Math.round(diff / 3600000)} h ago`
  if (diff < 7 * day) return `${Math.round(diff / day)} d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
