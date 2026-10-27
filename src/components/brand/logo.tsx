import { cn } from '@/lib/cn'

/** The DealCraft mark: two offers meeting across a table. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden>
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeOpacity="0.35" />
      <path d="M16 3.5a12.5 12.5 0 0 0 0 25z" fill="var(--gold)" />
      <path d="M16 8.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" fillOpacity="0.9" />
      <circle cx="16" cy="16" r="1.6" fill="var(--bg)" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-ink', className)}>
      <LogoMark />
      <span className="font-display text-[1.35rem] font-[500] tracking-[-0.01em]">DealCraft</span>
    </span>
  )
}
