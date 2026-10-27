'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useToast } from '@/components/ui/toast'

/** "Replay from here" buttons for each of the player's moves. */
export function ReplayButton({ gameId, snapshot, label }: { gameId: string; snapshot: number; label: string }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const r = await api<{ id: string }>(`/api/games/${gameId}/replay`, { body: { snapshot } })
          router.push(`/play/${r.id}`)
        } catch (e) {
          toast(e instanceof Error ? e.message : 'Could not start the replay.', 'bad')
          setBusy(false)
        }
      }}
      className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11.5px] text-ink-3 transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50"
      aria-label={`Replay from: ${label}`}
    >
      <RotateCcw className="size-3" aria-hidden /> Replay from here
    </button>
  )
}
