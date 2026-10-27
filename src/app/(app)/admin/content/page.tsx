import type { Metadata } from 'next'
import { Panel } from '@/components/ui/misc'
import { PublishToggle } from '@/components/app/admin-controls'
import { requirePermission } from '@/server/auth/guard'
import { listAdminPrograms } from '@/server/services/admin'

export const metadata: Metadata = { title: 'Academy content' }

export default async function AdminContent() {
  const actor = await requirePermission('content:manage')
  const programs = await listAdminPrograms(actor)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {programs.map((p) => (
        <Panel key={p.id}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl">{p.title}</h2>
            <PublishToggle path={`/api/admin/content/program/${p.slug}`} published={p.published} />
          </div>
          <ul className="mt-3 divide-y divide-line">
            {p.lessons.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className={l.published ? 'text-ink-2' : 'text-ink-3 line-through'}>{l.title}</span>
                <PublishToggle path={`/api/admin/content/lesson/${l.slug}`} published={l.published} />
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  )
}
