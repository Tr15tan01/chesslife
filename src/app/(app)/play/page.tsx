import type { Metadata } from 'next'
import Link from 'next/link'
import { Crown } from 'lucide-react'
import { PageHeader } from '@/components/app/app-shell'
import { Button } from '@/components/ui/button'
import { ScenarioPicker } from '@/components/play/scenario-picker'
import { requireUser } from '@/server/auth/guard'
import { listScenarios } from '@/server/services/scenarios'
import { aiAvailable } from '@/server/services/flags'
import { getDb } from '@/server/db'

export const metadata: Metadata = { title: 'Play' }

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ mode?: string; timed?: string; quick?: string }> }) {
  const user = await requireUser()
  const sp = await searchParams
  const [scenarios, ai, prefs] = await Promise.all([listScenarios({}, user.id), aiAvailable(), (await getDb()).preferences.findOne({ _id: user.id })])
  const mode = sp.mode === 'AI' || sp.mode === 'CLASSIC' ? sp.mode : (prefs?.defaultMode ?? 'CLASSIC')
  return (
    <div className="pb-16">
      <PageHeader
        title="Choose your negotiation"
        description="Pick a mode and a scenario. You will have a moment to prepare before the conversation starts."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/play/chess">
              <Crown className="size-4" aria-hidden /> Play Life Chess
            </Link>
          </Button>
        }
      />
      <div className="px-4 pt-6 sm:px-8">
        <ScenarioPicker scenarios={scenarios} aiAvailable={ai} initial={{ mode, timed: sp.timed === '1' || Boolean(prefs?.timedByDefault), quick: sp.quick === '1' }} />
      </div>
    </div>
  )
}
