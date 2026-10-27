'use client'

import * as D from '@radix-ui/react-dialog'
import { useState } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  CloudLightning,
  CloudRain,
  Coins,
  Crown,
  Flag,
  Hourglass,
  Lightbulb,
  Mountain,
  Scale,
  Shield,
  Sparkles,
  Sprout,
  Sunrise,
  Trophy,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { MomentKind, SceneQuality, SceneView } from '@/lib/chess/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/misc'
import { cn } from '@/lib/cn'

export const KIND_META: Record<MomentKind, { label: string; icon: LucideIcon; tone: 'gold' | 'ok' | 'bad' | 'blue' }> = {
  OPENING: { label: 'New beginning', icon: Sunrise, tone: 'gold' },
  DEVELOPMENT: { label: 'Growth', icon: Sprout, tone: 'ok' },
  CASTLE: { label: 'Safety net', icon: Shield, tone: 'blue' },
  CAPTURE: { label: 'Small win', icon: Coins, tone: 'ok' },
  BIG_CAPTURE: { label: 'Big win', icon: Trophy, tone: 'gold' },
  LOSS: { label: 'Setback', icon: CloudRain, tone: 'bad' },
  BIG_LOSS: { label: 'Major setback', icon: CloudLightning, tone: 'bad' },
  TRADE: { label: 'Fair trade', icon: ArrowLeftRight, tone: 'blue' },
  CHECK_GIVEN: { label: 'Applying pressure', icon: Zap, tone: 'gold' },
  CHECK_RECEIVED: { label: 'Under pressure', icon: AlertTriangle, tone: 'bad' },
  BLUNDER: { label: 'Rushed decision', icon: Hourglass, tone: 'bad' },
  PROMOTION: { label: 'Promotion', icon: Crown, tone: 'gold' },
  ENDGAME: { label: 'The long game', icon: Mountain, tone: 'blue' },
  WIN: { label: 'Victory', icon: Trophy, tone: 'gold' },
  LOSE: { label: 'Defeat', icon: Flag, tone: 'bad' },
  DRAW: { label: 'Draw', icon: Scale, tone: 'blue' },
}

export const QUALITY_META: Record<SceneQuality, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
  wise: { label: 'Wise choice', tone: 'ok' },
  mixed: { label: 'Mixed result', tone: 'warn' },
  risky: { label: 'Risky choice', tone: 'bad' },
}

const TONE_BG = { gold: 'from-gold/30', ok: 'from-ok/30', bad: 'from-bad/30', blue: 'from-s2/30' }
const TONE_TEXT = { gold: 'text-gold', ok: 'text-ok', bad: 'text-bad', blue: 'text-s2' }

export function SceneCard({ scene, open, onOpenChange, onChoose }: { scene: SceneView | null; open: boolean; onOpenChange: (o: boolean) => void; onChoose: (sceneId: string, key: string) => Promise<void> }) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  if (!scene) return null
  const meta = KIND_META[scene.kind]
  const Icon = meta.icon
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[3px] data-[state=open]:animate-[rise_.25s_ease]" />
        <D.Content className="panel fixed left-1/2 top-1/2 z-50 max-h-[92dvh] w-[min(94vw,34rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto shadow-lg focus:outline-none data-[state=open]:animate-[scene-in_.5s_cubic-bezier(.2,.8,.2,1)]">
          <div className={cn('relative overflow-hidden rounded-t-[16px] bg-gradient-to-b to-transparent px-6 pb-4 pt-6', TONE_BG[meta.tone])}>
            <div className={cn('mb-3 inline-flex items-center gap-2 text-[12.5px] font-medium uppercase tracking-[0.12em]', TONE_TEXT[meta.tone])}>
              <span className="grid size-7 place-items-center rounded-full bg-surface/70 ring-1 ring-current/30 animate-[scene-pop_.6s_.15s_both]">
                <Icon className="size-4" aria-hidden />
              </span>
              Life scene · {meta.label}
            </div>
            <D.Title className="font-display text-[1.75rem] leading-tight">{scene.title}</D.Title>
            <p className="mt-1 text-[13px] text-ink-3">{scene.setting}</p>
          </div>
          <div className="space-y-5 px-6 pb-6">
            <D.Description className="text-[15.5px] leading-relaxed text-ink">{scene.body}</D.Description>
            {(scene.source === 'ai' || scene.source === 'mock-ai') && (
              <p className="-mt-3 inline-flex items-center gap-1 text-[11.5px] text-ink-3">
                <Sparkles className="size-3" aria-hidden /> {scene.source === 'mock-ai' ? 'Simulated AI narration (mock provider)' : 'AI-narrated'}
              </p>
            )}
            {!scene.chosen ? (
              <div className="space-y-2.5" role="group" aria-label="How do you respond?">
                <p className="text-[13px] font-medium text-ink-2">How do you respond?</p>
                {scene.options.map((o, i) => (
                  <button
                    key={o.key}
                    type="button"
                    disabled={busyKey !== null}
                    onClick={async () => {
                      setBusyKey(o.key)
                      try {
                        await onChoose(scene.id, o.key)
                      } finally {
                        setBusyKey(null)
                      }
                    }}
                    className="group flex w-full items-center gap-3 rounded-[12px] border border-line-strong bg-surface-2/50 px-4 py-3 text-left text-[14.5px] transition-[border,background,transform] hover:-translate-y-px hover:border-gold/60 hover:bg-surface-2 disabled:opacity-60 animate-[rise_.5s_both]"
                    style={{ animationDelay: `${0.15 + i * 0.08}s` }}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line-strong text-[12px] text-ink-3 group-hover:border-gold group-hover:text-gold">{String.fromCharCode(65 + i)}</span>
                    <span className="flex-1">{o.label}</span>
                    {busyKey === o.key && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
                  </button>
                ))}
                <p className="pt-1 text-[12px] text-ink-3">Your choice never changes the board. It is a moment to think about how the move would play out in real life.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-rise">
                <div className="rounded-[12px] border border-line bg-surface-2/60 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[13px] text-ink-3">You chose: {scene.options.find((o) => o.key === scene.chosen!.key)?.label}</p>
                    <Badge tone={QUALITY_META[scene.chosen.quality].tone}>{QUALITY_META[scene.chosen.quality].label}</Badge>
                  </div>
                  <p className="text-[15px] leading-relaxed">{scene.chosen.outcome}</p>
                </div>
                <div className="flex gap-3 rounded-[12px] bg-gold/10 p-4 ring-1 ring-gold/25">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                  <p className="text-[14px] leading-relaxed text-ink-2">
                    <span className="font-medium text-gold">On the board and in life: </span>
                    {scene.lesson}
                  </p>
                </div>
                <D.Close asChild>
                  <Button className="w-full">Back to the board</Button>
                </D.Close>
              </div>
            )}
          </div>
          <D.Close className="absolute right-4 top-4 rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close scene">
            <X className="size-4" />
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
