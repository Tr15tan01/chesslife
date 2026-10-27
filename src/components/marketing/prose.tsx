import type { ReactNode } from 'react'

export function PageIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border-b border-line">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-14 sm:px-6 lg:px-8">
        <h1 className="display-lg max-w-3xl">{title}</h1>
        {children && <div className="lede mt-4">{children}</div>}
      </div>
    </div>
  )
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h3]:mt-6 [&_h3]:font-sans [&_h3]:text-base [&_h3]:font-semibold [&_li]:mt-1.5 [&_p]:mt-4 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-ink-2 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-[15px] [&_ul]:text-ink-2">
      {children}
    </div>
  )
}

export function TemplateNotice() {
  return (
    <p className="rounded-[12px] border border-warn/50 bg-warn/10 p-4 text-sm !text-ink">
      This is an editable template provided with the DealCraft codebase. It has not been reviewed by a lawyer. Replace the bracketed placeholders and have it reviewed before relying on it.
    </p>
  )
}
