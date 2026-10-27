import type { Metadata } from 'next'
import Link from 'next/link'
import { Panel } from '@/components/ui/misc'
import { ScenarioEditor } from '@/components/app/admin-controls'
import { requirePermission } from '@/server/auth/guard'
import { getAdminScenario } from '@/server/services/admin'

export const metadata: Metadata = { title: 'Edit scenario' }

export default async function EditScenario({ params }: { params: Promise<{ slug: string }> }) {
  const actor = await requirePermission('content:manage')
  const { slug } = await params
  const { doc, weights } = await getAdminScenario(actor, slug)
  return (
    <div className="space-y-4">
      <Link href="/admin/scenarios" className="text-[13px] text-ink-3 hover:text-ink">
        All scenarios
      </Link>
      <Panel>
        <h2 className="mb-5 font-display text-2xl">
          {doc.title} <span className="text-base text-ink-3">v{doc.currentVersion}</span>
        </h2>
        <ScenarioEditor slug={slug} initial={{ title: doc.title, summary: doc.summary, difficulty: doc.difficulty, tags: doc.tags, weights }} />
      </Panel>
    </div>
  )
}
