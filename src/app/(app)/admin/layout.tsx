import Link from 'next/link'
import { PageHeader } from '@/components/app/app-shell'
import { requirePermission } from '@/server/auth/guard'
import { can } from '@/server/auth/permissions'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermission('admin:view')
  const tabs = [
    ['/admin', 'Overview', true],
    ['/admin/users', 'Users', can(user.role, 'admin:users')],
    ['/admin/scenarios', 'Scenarios', can(user.role, 'content:manage')],
    ['/admin/content', 'Academy', can(user.role, 'content:manage')],
    ['/admin/flags', 'Features', can(user.role, 'admin:flags')],
    ['/admin/audit', 'Audit log', can(user.role, 'admin:audit')],
    ['/admin/errors', 'Errors', can(user.role, 'admin:errors')],
  ] as const
  return (
    <div className="pb-16">
      <PageHeader title="Administration" description={user.role === 'ADMIN' ? 'Administrator access. Every change is recorded in the audit log.' : 'Content manager access: scenarios and training content.'} />
      <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto border-b border-line px-4 sm:px-8">
        {tabs
          .filter((t) => t[2])
          .map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm text-ink-2 hover:text-ink">
              {label}
            </Link>
          ))}
      </nav>
      <div className="px-4 pt-6 sm:px-8">{children}</div>
    </div>
  )
}
