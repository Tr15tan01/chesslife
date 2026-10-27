import type { Metadata } from 'next'
import Link from 'next/link'
import { PublishToggle } from '@/components/app/admin-controls'
import { CATEGORY_LABELS, DIFFICULTY_LABELS } from '@/lib/negotiation/types'
import { requirePermission } from '@/server/auth/guard'
import { listAdminScenarios } from '@/server/services/admin'

export const metadata: Metadata = { title: 'Manage scenarios' }

export default async function AdminScenarios() {
  const actor = await requirePermission('content:manage')
  const rows = await listAdminScenarios(actor)
  return (
    <div className="panel overflow-x-auto p-0">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-line text-left text-[12.5px] text-ink-3">
          <tr>
            <th className="px-5 py-3 font-medium">Scenario</th>
            <th className="px-3 py-3 font-medium">Category</th>
            <th className="px-3 py-3 font-medium">Difficulty</th>
            <th className="px-3 py-3 font-medium">Version</th>
            <th className="px-5 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line/60 last:border-0">
              <td className="px-5 py-3">
                <Link href={`/admin/scenarios/${r.slug}`} className="text-ink hover:text-gold-strong">
                  {r.title}
                </Link>
                <span className="block text-[12px] text-ink-3">{r.slug}</span>
              </td>
              <td className="px-3 py-3 text-ink-2">{CATEGORY_LABELS[r.category]}</td>
              <td className="px-3 py-3 text-ink-2">{DIFFICULTY_LABELS[r.difficulty]}</td>
              <td className="tabular px-3 py-3">v{r.version}</td>
              <td className="px-5 py-3">
                <PublishToggle path={`/api/admin/scenarios/${r.slug}`} published={r.published} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
