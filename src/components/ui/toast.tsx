'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'

type Toast = { id: number; tone: 'ok' | 'bad' | 'info'; text: string }
const Ctx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x.slice(-2), { id, tone, text }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="glass pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full px-4 py-2.5 text-sm shadow-lg animate-rise">
            {t.tone === 'ok' ? <CheckCircle2 className="size-4 text-ok" /> : t.tone === 'bad' ? <AlertTriangle className="size-4 text-bad" /> : <Info className="size-4 text-gold" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
