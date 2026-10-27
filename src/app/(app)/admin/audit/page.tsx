import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePermission } from '@/server/auth/guard'
import { listAudit } from '@/server/services/admin'

export const metadata: Metadata = { title: 'Audit log' }

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requirePermission('admin:audit')
  const page = Math.max(1, Math.min(1000, Number((await searchParams).page) || 1))
  const { rows, total, pageSize } = await listAudit(actor, page)
  return (
    <div className="space-y-4">
      <div className="panel overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line text-left text-[12.5px] text-ink-3">
            <tr>
              <th className="px-5 py-3 font-medium">When</th>
              <th className="px-3 py-3 font-medium">Actor</th>
              <th className="px-3 py-3 font-medium">Action</th>
              <th className="px-5 py-3 font-medium">Target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-b border-line/60 last:border-0">
                <td className="px-5 py-2.5 text-ink-3">{new Date(r.createdAt).toLocaleString('en-GB')}</td>
                <td className="px-3 py-2.5 text-ink-2">{r.actorEmail || 'system'}</td>
                <td className="px-3 py-2.5 text-ink">{r.action}</td>
                <td className="px-5 py-2.5 text-[12.5px] text-ink-3">
                  {r.targetType} {r.targetId} {Object.keys(r.meta).length ? JSON.stringify(r.meta) : ''}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-ink-3">
                  No audited actions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="flex justify-between text-sm text-ink-3">
        <span>{total} entries</span>
        <span className="space-x-4">
          {page > 1 && <Link className="text-gold" href={`/admin/audit?page=${page - 1}`}>Newer</Link>}
          {page * pageSize < total && <Link className="text-gold" href={`/admin/audit?page=${page + 1}`}>Older</Link>}
        </span>
      </p>
    </div>
  )
}
