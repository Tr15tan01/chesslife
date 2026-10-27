'use client'

import * as D from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Dialog({ open, onOpenChange, title, description, children, trigger, className }: { open?: boolean; onOpenChange?: (o: boolean) => void; title: string; description?: ReactNode; children: ReactNode; trigger?: ReactNode; className?: string }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-[rise_.2s_ease]" />
        <D.Content className={cn('panel fixed left-1/2 top-1/2 z-50 w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 p-6 shadow-lg focus:outline-none', className)}>
          <D.Title className="font-display text-2xl">{title}</D.Title>
          {description && <D.Description className="mt-2 text-sm text-ink-2">{description}</D.Description>}
          <div className="mt-5">{children}</div>
          <D.Close className="absolute right-4 top-4 rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

export const DialogClose = D.Close
