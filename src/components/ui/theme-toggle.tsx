'use client'

import { Moon, Sun } from 'lucide-react'

export function setThemeCookie(theme: 'dark' | 'light') {
  document.documentElement.dataset.theme = theme
  document.cookie = `dc_theme=${theme}; path=/; max-age=31536000; samesite=lax`
}

/** Stateless: the icon follows the <html data-theme> attribute via CSS, so SSR and client always match. */
export function ThemeToggle({ signedIn = false }: { signedIn?: boolean }) {
  const flip = () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'
    setThemeCookie(next)
    if (signedIn) void fetch('/api/account/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: next }) }).catch(() => {})
  }
  return (
    <button type="button" onClick={flip} className="rounded-full p-2 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink" aria-label="Toggle light and dark theme">
      <Sun className="size-[18px] [[data-theme=light]_&]:hidden" aria-hidden />
      <Moon className="hidden size-[18px] [[data-theme=light]_&]:block" aria-hidden />
    </button>
  )
}
