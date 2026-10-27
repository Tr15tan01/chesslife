import { cn } from '@/lib/cn'
import type { CounterpartPublic } from '@/lib/negotiation/types'

const TONES: Record<CounterpartPublic['tone'], string> = {
  gold: 'bg-[#3a2f1a] text-[#e8cf98] ring-[#6b5528]',
  slate: 'bg-[#232b3d] text-[#c3cde4] ring-[#3b4763]',
  sage: 'bg-[#1f3229] text-[#b8dcc6] ring-[#355546]',
  rose: 'bg-[#3a2324] text-[#ebc0b9] ring-[#633c3b]',
  ink: 'bg-[#1b1e26] text-[#d9d3c4] ring-[#3a3f4c]',
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function Avatar({ name, tone = 'slate', size = 'md', className }: { name: string; tone?: CounterpartPublic['tone']; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = { sm: 'size-8 text-[12px]', md: 'size-11 text-sm', lg: 'size-16 text-lg' }[size]
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full font-semibold ring-1', TONES[tone], s, className)} aria-hidden>
      {initials(name)}
    </span>
  )
}
