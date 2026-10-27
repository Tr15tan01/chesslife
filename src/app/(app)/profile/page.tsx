import type { Metadata } from 'next'
import { PageHeader } from '@/components/app/app-shell'
import { Panel, PanelTitle, Badge } from '@/components/ui/misc'
import { ProfileForm } from '@/components/app/account-forms'
import { Avatar } from '@/components/marketing/avatar'
import { requireUser } from '@/server/auth/guard'
import { getDb } from '@/server/db'
import type { Dimension } from '@/lib/negotiation/types'

export const metadata: Metadata = { title: 'Profile' }

export default async function ProfilePage() {
  const user = await requireUser()
  const db = await getDb()
  const [prefs, progress, doc] = await Promise.all([db.preferences.findOne({ _id: user.id }), db.progress.findOne({ _id: user.id }), db.users.findOne({ _id: user.id }, { projection: { createdAt: 1 } })])
  return (
    <div className="pb-16">
      <PageHeader title="Profile" description="How you appear in DealCraft and what you want to practise." />
      <div className="grid gap-6 px-4 pt-6 sm:px-8 xl:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelTitle>Profile and learning preferences</PanelTitle>
          <ProfileForm name={user.name} prefs={{ theme: prefs?.theme ?? 'dark', focusSkills: (prefs?.focusSkills ?? []) as Dimension[], defaultMode: prefs?.defaultMode ?? 'CLASSIC', timedByDefault: prefs?.timedByDefault ?? false, showRapport: prefs?.showRapport ?? true }} />
        </Panel>
        <Panel>
          <div className="flex items-center gap-4">
            <Avatar name={user.name} tone="gold" size="lg" />
            <div>
              <p className="font-display text-2xl">{user.name}</p>
              <p className="text-sm text-ink-3">{user.email}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={user.emailVerified ? 'ok' : 'warn'}>{user.emailVerified ? 'Email verified' : 'Email not verified'}</Badge>
            <Badge>{user.plan === 'PREMIUM' ? 'Premium' : 'Free plan'}</Badge>
            {user.role !== 'USER' && <Badge tone="gold">{user.role === 'ADMIN' ? 'Administrator' : 'Content manager'}</Badge>}
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-ink-3">Member since</dt>
              <dd>{doc?.createdAt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Negotiations</dt>
              <dd className="tabular">{progress?.gamesCompleted ?? 0}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Best score</dt>
              <dd className="tabular">{progress?.bestScore ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Longest streak</dt>
              <dd className="tabular">{progress?.streak.best ?? 0} days</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  )
}
