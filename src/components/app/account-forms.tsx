'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Download } from 'lucide-react'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { setThemeCookie } from '@/components/ui/theme-toggle'
import { DIMENSIONS, DIMENSION_LABELS, type Dimension } from '@/lib/negotiation/types'
import { cn } from '@/lib/cn'

type Prefs = { theme: 'dark' | 'light'; focusSkills: Dimension[]; defaultMode: 'CLASSIC' | 'AI'; timedByDefault: boolean; showRapport: boolean }

async function savePrefs(patch: Partial<Prefs>) {
  await api('/api/account/preferences', { method: 'PATCH', body: patch })
}

export function ProfileForm({ name: initialName, prefs }: { name: string; prefs: Prefs }) {
  const router = useRouter()
  const toast = useToast()
  const [name, setName] = useState(initialName)
  const [focus, setFocus] = useState<Dimension[]>(prefs.focusSkills)
  const [mode, setMode] = useState(prefs.defaultMode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('/api/account/profile', { method: 'PATCH', body: { name } })
      await savePrefs({ focusSkills: focus, defaultMode: mode })
      toast('Profile saved.', 'ok')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-6">
      <Field label="Display name" error={error}>
        {(p) => <Input {...p} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2">Skills you want to focus on (up to three)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIMENSIONS.map((d) => {
            const on = focus.includes(d)
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => setFocus((f) => (on ? f.filter((x) => x !== d) : f.length < 3 ? [...f, d] : f))} className={cn('rounded-full border px-3 py-1 text-[13px] transition-colors', on ? 'border-gold bg-gold/15 text-ink' : 'border-line text-ink-2 hover:text-ink')}>
                {DIMENSION_LABELS[d]}
              </button>
            )
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2">Default mode</legend>
        <div className="mt-2 flex gap-2">
          {(['CLASSIC', 'AI'] as const).map((m) => (
            <label key={m} className={cn('cursor-pointer rounded-full border px-3.5 py-1.5 text-sm', mode === m ? 'border-gold bg-gold/15 text-ink' : 'border-line text-ink-2')}>
              <input type="radio" name="mode" className="sr-only" checked={mode === m} onChange={() => setMode(m)} />
              {m === 'AI' ? 'AI negotiation' : 'Classic'}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" loading={busy}>
        Save profile
      </Button>
    </form>
  )
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 py-4">
      <span>
        <span className="block text-sm text-ink">{label}</span>
        <span className="block text-[13px] text-ink-3">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 accent-[var(--gold)]" />
    </label>
  )
}

export function PreferenceToggles({ prefs }: { prefs: Prefs }) {
  const toast = useToast()
  const [p, setP] = useState(prefs)
  const update = async (patch: Partial<Prefs>) => {
    setP((x) => ({ ...x, ...patch }))
    if (patch.theme) setThemeCookie(patch.theme)
    try {
      await savePrefs(patch)
      toast('Preference saved.', 'ok')
    } catch {
      toast('Could not save that preference.', 'bad')
    }
  }
  return (
    <div className="divide-y divide-line">
      <Toggle label="Light theme" hint="Ivory paper instead of graphite. Saved to your account and this browser." on={p.theme === 'light'} onChange={(v) => update({ theme: v ? 'light' : 'dark' })} />
      <Toggle label="Show rapport meter" hint="See an approximate read of how the other side feels during play." on={p.showRapport} onChange={(v) => update({ showRapport: v })} />
      <Toggle label="Timed by default" hint="Pre-select the server-enforced clock when choosing a scenario." on={p.timedByDefault} onChange={(v) => update({ timedByDefault: v })} />
    </div>
  )
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('/api/account/password', { body: { current, next } })
      setCurrent('')
      setNext('')
      toast('Password updated. Other devices were signed out.', 'ok')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update password.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {hasPassword && <Field label="Current password">{(p) => <Input {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}</Field>}
      <Field label={hasPassword ? 'New password' : 'Set a password'} hint="At least 10 characters, mixing letters with numbers or symbols." error={error}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
      </Field>
      <Button type="submit" variant="secondary" loading={busy} disabled={!next}>
        {hasPassword ? 'Change password' : 'Set password'}
      </Button>
    </form>
  )
}

export function SessionControls({ verified }: { verified: boolean }) {
  const router = useRouter()
  const toast = useToast()
  return (
    <div className="flex flex-wrap gap-2">
      {!verified && (
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              const r = await api<{ sent: boolean }>('/api/auth/resend-verification', { body: {} })
              toast(r.sent ? 'Confirmation email sent.' : 'Email is not configured on this server.', r.sent ? 'ok' : 'info')
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Could not send.', 'bad')
            }
          }}
        >
          Resend confirmation email
        </Button>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          await api('/api/account/signout-all', { body: {} })
          router.replace('/login')
          router.refresh()
        }}
      >
        Sign out everywhere
      </Button>
    </div>
  )
}

export function GoogleLink({ linked, enabled, hasPassword, status }: { linked: boolean; enabled: boolean; hasPassword: boolean; status?: string }) {
  const router = useRouter()
  const toast = useToast()
  const messages: Record<string, string> = { linked: 'Google account linked.', 'already-linked': 'That Google account is linked to another DealCraft account.', unverified: 'Google has not verified that email address.' }
  return (
    <div className="space-y-3 text-sm">
      {status && messages[status] && <p className="text-ink-2">{messages[status]}</p>}
      {linked ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-ink-2">Google sign-in is linked to this account.</p>
          <Button
            size="sm"
            variant="ghost"
            disabled={!hasPassword}
            title={hasPassword ? undefined : 'Set a password first'}
            onClick={async () => {
              try {
                await api('/api/account/google', { method: 'DELETE' })
                toast('Google unlinked.', 'ok')
                router.refresh()
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Could not unlink.', 'bad')
              }
            }}
          >
            Unlink
          </Button>
        </div>
      ) : enabled ? (
        <Button asChild size="sm" variant="secondary">
          <a href="/api/auth/google/start?intent=link">Link Google account</a>
        </Button>
      ) : (
        <p className="text-ink-3">Google sign-in is not enabled on this server.</p>
      )}
    </div>
  )
}

export function DataControls({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [phrase, setPhrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="secondary" size="sm">
        <a href="/api/account/export" download>
          <Download className="size-4" aria-hidden /> Export my data
        </a>
      </Button>
      <Dialog
        title="Delete your account?"
        description="This permanently deletes your profile, negotiations, evaluations, custom scenarios and preferences. It cannot be undone."
        trigger={
          <Button variant="danger" size="sm">
            Delete account
          </Button>
        }
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            try {
              await api('/api/account/delete', { body: hasPassword ? { password } : { phrase } })
              router.replace('/')
              router.refresh()
            } catch (err) {
              setError(err instanceof ApiError ? err.message : 'Could not delete the account.')
              setBusy(false)
            }
          }}
        >
          {hasPassword ? (
            <Field label="Confirm with your password" error={error}>{(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
          ) : (
            <Field label="Type DELETE to confirm" error={error}>{(p) => <Input {...p} value={phrase} onChange={(e) => setPhrase(e.target.value)} />}</Field>
          )}
          <Button type="submit" variant="danger" loading={busy} className="w-full">
            Permanently delete my account
          </Button>
        </form>
      </Dialog>
    </div>
  )
}
