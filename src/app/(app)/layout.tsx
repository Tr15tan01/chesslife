import { AppShell } from '@/components/app/app-shell'
import { requireUser } from '@/server/auth/guard'
import { can } from '@/server/auth/permissions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  return <AppShell user={{ name: user.name, email: user.email, isStaff: can(user.role, 'admin:view') }}>{children}</AppShell>
}
