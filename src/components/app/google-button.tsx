export function GoogleButton({ next, label = 'Continue with Google' }: { next?: string; label?: string }) {
  const href = `/api/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ''}`
  return (
    <a href={href} className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-line-strong bg-surface text-sm font-medium text-ink transition-colors hover:border-gold/60">
      <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
      </svg>
      {label}
    </a>
  )
}
