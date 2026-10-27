'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { BarChart3, BookOpen, Crown, Flag, History, LayoutDashboard, LogOut, Menu, Puzzle, Settings, Shield, Swords, User, X } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/cn'
import { Avatar } from '@/components/marketing/avatar'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/play', label: 'Play', icon: Swords },
  { href: '/play/chess', label: 'Life Chess', icon: Crown },
  { href: '/training', label: 'Academy', icon: BookOpen },
  { href: '/challenges', label: 'Challenges', icon: Flag },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
  { href: '/history', label: 'History', icon: History },
  { href: '/custom', label: 'Custom scenarios', icon: Puzzle },
]

type ShellUser = { name: string; email: string; isStaff: boolean }

function NavLinks({ user, onNavigate }: { user: ShellUser; onNavigate?: () => void }) {
  const path = usePathname()
  const item = (href: string, label: string, Icon: typeof User) => {
    const active = (path === href || path.startsWith(`${href}/`) || (href === '/play' && path.startsWith('/results'))) && !(href === '/play' && path.startsWith('/play/chess'))
    return (
      <Link key={href} href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={cn('group flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] transition-colors', active ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2/60 hover:text-ink')}>
        <Icon className={cn('size-[18px]', active ? 'text-gold' : 'text-ink-3 group-hover:text-ink-2')} aria-hidden />
        {label}
      </Link>
    )
  }
  return (
    <nav aria-label="App" className="flex flex-1 flex-col gap-0.5">
      {NAV.map((n) => item(n.href, n.label, n.icon))}
      <div className="my-3 h-px bg-line" />
      {item('/profile', 'Profile', User)}
      {item('/settings', 'Settings', Settings)}
      {user.isStaff && item('/admin', 'Admin', Shield)}
    </nav>
  )
}

function SignOut() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.replace('/')
        router.refresh()
      }}
      className="rounded-full p-2 text-ink-3 hover:bg-surface-2 hover:text-ink"
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut className="size-[18px]" />
    </button>
  )
}

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const path = usePathname()
  // Close the menu on navigation (render-time state adjustment, no effect needed).
  const [lastPath, setLastPath] = useState(path)
  if (lastPath !== path) {
    setLastPath(path)
    setOpen(false)
  }
  const footer = (
    <div className="flex items-center gap-3 border-t border-line pt-4">
      <Avatar name={user.name} tone="gold" size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{user.name}</p>
        <p className="truncate text-[12px] text-ink-3">{user.email}</p>
      </div>
      <ThemeToggle signedIn />
      <SignOut />
    </div>
  )
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-bg-deep/60 px-4 py-5 lg:flex">
        <Link href="/" className="px-2" aria-label="DealCraft home">
          <Logo />
        </Link>
        <NavLinks user={user} />
        {footer}
      </aside>
      <header className="glass sticky top-0 z-40 flex h-14 items-center justify-between border-x-0 border-t-0 px-4 lg:hidden">
        <Link href="/dashboard" aria-label="Dashboard">
          <Logo />
        </Link>
        <button type="button" onClick={() => setOpen(true)} className="rounded-full p-2 text-ink-2" aria-label="Open navigation" aria-expanded={open} aria-controls="app-drawer">
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div id="app-drawer" className="absolute inset-y-0 right-0 flex w-[min(86vw,320px)] flex-col gap-6 bg-bg px-4 py-5 shadow-lg animate-rise">
            <div className="flex items-center justify-between">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-ink-2" aria-label="Close navigation">
                <X className="size-5" />
              </button>
            </div>
            <NavLinks user={user} onNavigate={() => setOpen(false)} />
            {footer}
          </div>
        </div>
      )}
      <main id="main" className="min-w-0">
        {children}
      </main>
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-line px-4 pb-6 pt-8 sm:px-8 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="display-lg">{title}</h1>
        {description && <div className="mt-2 max-w-2xl text-[15px] text-ink-2">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
