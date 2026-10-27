import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'ok' | 'bad' | 'warn' | 'blue'; className?: string }) {
  const tones = {
    neutral: 'border-line-strong text-ink-2',
    gold: 'border-gold/50 text-gold',
    ok: 'border-ok/50 text-ok',
    bad: 'border-bad/50 text-bad',
    warn: 'border-warn/50 text-warn',
    blue: 'border-s2/50 text-s2',
  }
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium leading-5', tones[tone], className)}>{children}</span>
}

export function Panel({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' | 'aside' }) {
  return <As className={cn('panel p-5 sm:p-6', className)}>{children}</As>
}

export function PanelTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex items-baseline justify-between gap-4', className)}>
      <h2 className="font-display text-[1.3rem] font-[450] text-ink">{children}</h2>
      {action}
    </div>
  )
}

export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[14px] border border-dashed border-line-strong px-5 py-8">
      {icon && <div className="text-gold">{icon}</div>}
      <h3 className="font-display text-xl">{title}</h3>
      {children && <div className="max-w-md text-sm text-ink-2">{children}</div>}
      {action}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[10px] bg-surface-2', className)} aria-hidden />
}

export function Meter({ value, label, className, tone = 'gold' }: { value: number; label: string; className?: string; tone?: 'gold' | 'ok' | 'bad' | 'blue' }) {
  const colors = { gold: 'bg-gold', ok: 'bg-ok', bad: 'bg-bad', blue: 'bg-s2' }
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label}>
      <div className={cn('h-full rounded-full transition-[width] duration-700', colors[tone])} style={{ width: `${v}%` }} />
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">{children}</kbd>
}
