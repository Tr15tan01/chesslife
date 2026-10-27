import type { Metadata } from 'next'
import { requirePermission } from '@/server/auth/guard'
import { listErrors } from '@/server/services/admin'

export const metadata: Metadata = { title: 'Errors' }

export default async function ErrorsPage() {
  const actor = await requirePermission('admin:errors')
  const rows = await listErrors(actor)
  return (
    <div className="panel p-0">
      <p className="border-b border-line px-5 py-3 text-[13px] text-ink-3">Latest 50 server errors. Messages are redacted and never include request bodies. Entries expire after 30 days.</p>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="px-5 py-3 text-sm">
            <p className="text-ink">{r.message}</p>
            <p className="text-[12px] text-ink-3">
              {r.scope}, {new Date(r.createdAt).toLocaleString('en-GB')}
            </p>
          </li>
        ))}
        {rows.length === 0 && <li className="px-5 py-6 text-sm text-ink-3">No errors recorded.</li>}
      </ul>
    </div>
  )
}
