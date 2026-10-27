import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/app/app-shell'
import { Panel, PanelTitle } from '@/components/ui/misc'
import { DataControls, GoogleLink, PasswordForm, PreferenceToggles, SessionControls } from '@/components/app/account-forms'
import { requireUser } from '@/server/auth/guard'
import { getDb } from '@/server/db'
import { isGoogleEnabled } from '@/server/env'
import type { Dimension } from '@/lib/negotiation/types'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const user = await requireUser()
  const db = await getDb()
  const [prefs, google] = await Promise.all([db.preferences.findOne({ _id: user.id }), db.oauthAccounts.findOne({ userId: user.id, provider: 'google' })])
  const sp = await searchParams
  return (
    <div className="pb-16">
      <PageHeader title="Settings" description="Account security, privacy and display preferences." />
      <div className="grid gap-6 px-4 pt-6 sm:px-8 xl:grid-cols-2">
        <Panel>
          <PanelTitle>Display and play</PanelTitle>
          <PreferenceToggles prefs={{ theme: prefs?.theme ?? 'dark', focusSkills: (prefs?.focusSkills ?? []) as Dimension[], defaultMode: prefs?.defaultMode ?? 'CLASSIC', timedByDefault: prefs?.timedByDefault ?? false, showRapport: prefs?.showRapport ?? true }} />
        </Panel>
        <Panel>
          <PanelTitle>Password</PanelTitle>
          <PasswordForm hasPassword={user.hasPassword} />
        </Panel>
        <Panel>
          <PanelTitle>Sign-in and sessions</PanelTitle>
          <div className="space-y-6">
            <GoogleLink linked={Boolean(google)} enabled={isGoogleEnabled()} hasPassword={user.hasPassword} status={sp.google} />
            <SessionControls verified={user.emailVerified} />
          </div>
        </Panel>
        <Panel>
          <PanelTitle>Your data</PanelTitle>
          <p className="mb-4 text-sm text-ink-2">
            Download everything we store about you as JSON, or delete your account permanently. In AI games, your messages are sent to the configured AI provider to generate replies. See the <Link href="/privacy" className="text-gold hover:underline">privacy policy</Link>.
          </p>
          <DataControls hasPassword={user.hasPassword} />
        </Panel>
      </div>
    </div>
  )
}
