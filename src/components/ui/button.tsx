import { Slot } from '@radix-ui/react-slot'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-gold text-gold-ink hover:bg-gold-strong shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--gold)_70%,transparent)]',
  secondary: 'border border-line-strong bg-surface-2/60 text-ink hover:border-gold/60 hover:bg-surface-2',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2/70',
  danger: 'bg-bad/90 text-white hover:bg-bad',
  quiet: 'text-gold hover:text-gold-strong underline-offset-4 hover:underline px-0',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2.5',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; asChild?: boolean; loading?: boolean }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant = 'primary', size = 'md', asChild, loading, disabled, children, ...props }, ref) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-full font-medium transition-[background,color,border,box-shadow,transform] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        variant !== 'quiet' && sizes[size],
        className,
      )}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? children : (
        <>
          {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  )
})
