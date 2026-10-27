import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const control =
  'w-full rounded-[10px] border border-line-strong bg-bg/60 px-3.5 text-[15px] text-ink placeholder:text-ink-3 transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25 disabled:opacity-60 aria-[invalid=true]:border-bad'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(control, 'h-11', className)} {...p} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(control, 'min-h-24 py-2.5 leading-relaxed', className)} {...p} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={cn(control, 'h-11 appearance-none bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-9', className)} {...p} />
})

/** Label + control + hint + error, wired with aria attributes. */
export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string | null; children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode; className?: string }) {
  const id = useId()
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-[12.5px] text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-[12.5px] text-bad">
          {error}
        </p>
      )}
    </div>
  )
}
