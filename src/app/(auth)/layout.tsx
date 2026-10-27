import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { TableFallback } from '@/components/three/hero-visual'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <main id="main" className="flex flex-col px-4 py-6 sm:px-10">
        <Link href="/" aria-label="DealCraft home" className="self-start">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-center text-[12.5px] text-ink-3">
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <span className="mx-2">/</span>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
        </p>
      </main>
      <aside className="grain relative hidden overflow-hidden border-l border-line bg-bg-deep lg:flex lg:flex-col lg:justify-end">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(70%_60%_at_60%_40%,color-mix(in_oklab,var(--gold)_12%,transparent),transparent_70%)]" />
        <div className="absolute inset-x-10 top-16 opacity-90">
          <TableFallback />
        </div>
        <blockquote className="relative m-12 max-w-md">
          <p className="font-display text-3xl leading-tight">Every good deal starts with a better question.</p>
          <footer className="mt-3 text-sm text-ink-3">Practise asking it here, before it counts.</footer>
        </blockquote>
      </aside>
    </div>
  )
}
