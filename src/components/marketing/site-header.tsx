'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/cn'

const NAV = [
  { href: '/scenarios', label: 'Scenarios' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
]

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  // Close the menu on navigation (render-time state adjustment, no effect needed).
  const [lastPath, setLastPath] = useState(path)
  if (lastPath !== path) {
    setLastPath(path)
    setOpen(false)
  }
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={cn('sticky top-0 z-40 transition-[background,border-color] duration-300', scrolled || open ? 'glass border-x-0 border-t-0' : 'border-b border-transparent')}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="DealCraft home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn('rounded-full px-3 py-1.5 text-sm transition-colors', path.startsWith(n.href) ? 'text-ink' : 'text-ink-2 hover:text-ink')} aria-current={path.startsWith(n.href) ? 'page' : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {signedIn ? (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Link href="/login" className="hidden px-3 text-sm text-ink-2 hover:text-ink sm:inline">
                Sign in
              </Link>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/register">Start negotiating</Link>
              </Button>
            </>
          )}
          <button type="button" className="rounded-full p-2 text-ink-2 hover:bg-surface-2 md:hidden" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line px-4 pb-5 pt-2 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="block border-b border-line/60 py-3 text-[15px] text-ink-2 hover:text-ink">
              {n.label}
            </Link>
          ))}
          <div className="mt-4 flex gap-2">
            {signedIn ? (
              <Button asChild className="flex-1">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="secondary" className="flex-1">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild className="flex-1">
                  <Link href="/register">Start negotiating</Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}
