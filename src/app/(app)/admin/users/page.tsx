import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/misc'
import { UserRow } from '@/components/app/admin-controls'
import { requirePermission } from '@/server/auth/guard'
import { listUsers, userQuerySchema } from '@/server/services/admin'

export const metadata: Metadata = { title: 'Users' }

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requirePermission('admin:users')
  const parsed = userQuerySchema.safeParse(await searchParams)
  const q = parsed.success ? parsed.data : userQuerySchema.parse({})
  const { users, total, pageSize } = await listUsers(actor, q)
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q.q} placeholder="Search email or name" aria-label="Search users" className="h-10 w-72 rounded-full border border-line-strong bg-surface px-4 text-sm" />
        <select name="role" defaultValue={q.role ?? ''} aria-label="Role" className="h-10 rounded-full border border-line bg-surface px-3 text-sm text-ink-2">
          <option value="">Any role</option>
          <option value="USER">User</option>
          <option value="CONTENT_MANAGER">Content manager</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select name="status" defaultValue={q.status ?? ''} aria-label="Status" className="h-10 rounded-full border border-line bg-surface px-3 text-sm text-ink-2">
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <button className="h-10 rounded-full border border-line-strong px-4 text-sm">Filter</button>
      </form>
      <div className="panel overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line text-left text-[12.5px] text-ink-3">
            <tr>
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-3 py-3 font-medium">Joined</th>
              <th className="px-3 py-3 font-medium">Games</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Role and access</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line/60 last:border-0">
                <td className="px-5 py-3">
                  <span className="block text-ink">{u.name}</span>
                  <span className="text-[12px] text-ink-3">
                    {u.email} {u.verified ? '' : '(unverified)'}
                  </span>
                </td>
                <td className="px-3 py-3 text-ink-3">{new Date(u.createdAt).toLocaleDateString('en-GB')}</td>
                <td className="tabular px-3 py-3">{u.games}</td>
                <td className="px-3 py-3">
                  <Badge tone={u.status === 'ACTIVE' ? 'ok' : 'bad'}>{u.status === 'ACTIVE' ? 'Active' : 'Suspended'}</Badge>
                </td>
                <td className="px-5 py-3">
                  <UserRow id={u.id} role={u.role} status={u.status} self={u.id === actor.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex justify-between text-sm text-ink-3">
        <span>{total} users</span>
        <span className="space-x-4">
          {q.page > 1 && <Link className="text-gold" href={`/admin/users?page=${q.page - 1}`}>Previous</Link>}
          <span>
            Page {q.page} of {pages}
          </span>
          {q.page < pages && <Link className="text-gold" href={`/admin/users?page=${q.page + 1}`}>Next</Link>}
        </span>
      </p>
    </div>
  )
}
