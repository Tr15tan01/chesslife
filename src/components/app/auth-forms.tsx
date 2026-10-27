'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { api, ApiError } from '@/lib/api-client'
import { GoogleButton } from './google-button'

const OAUTH_ERRORS: Record<string, string> = {
  'google-disabled': 'Google sign-in is not available on this server.',
  'oauth-state': 'The Google sign-in session expired. Please try again.',
  'oauth-failed': 'Google sign-in did not complete. Please try again.',
  unverified: 'Google has not verified that email address, so we cannot use it to sign in.',
  'link-required': 'An account with this email already exists. Sign in with your password, then link Google from Settings.',
  suspended: 'This account is suspended. Contact support if you think this is a mistake.',
  'rate-limited': 'Too many attempts. Please wait a few minutes and try again.',
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-[12px] text-ink-3">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

export function LoginForm({ next, google, oauthError }: { next: string; google: boolean; oauthError?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(oauthError ? (OAUTH_ERRORS[oauthError] ?? 'Sign-in failed. Please try again.') : null)
  const [loading, setLoading] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api('/api/auth/login', { body: { email, password } })
      router.replace(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed.')
      setLoading(false)
    }
  }
  return (
    <div>
      <h1 className="display-md">Welcome back</h1>
      <p className="mt-2 text-sm text-ink-2">Sign in to continue your training.</p>
      {error && (
        <p role="alert" className="mt-5 rounded-[10px] border border-bad/40 bg-bad/10 px-3.5 py-2.5 text-sm text-ink">
          {error}
        </p>
      )}
      {google && (
        <>
          <div className="mt-6">
            <GoogleButton next={next} />
          </div>
          <Divider />
        </>
      )}
      <form onSubmit={submit} className={google ? 'space-y-4' : 'mt-6 space-y-4'} noValidate>
        <Field label="Email">{(p) => <Input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="Password">{(p) => <Input {...p} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-[13px] text-gold hover:underline">
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        New to DealCraft?{' '}
        <Link href={`/register${next !== '/dashboard' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-gold hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}

export function RegisterForm({ next, google }: { next: string; google: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setErrors({})
    try {
      const r = await api<{ signedIn: boolean }>('/api/auth/register', { body: form })
      if (r.signedIn) {
        router.replace(next)
        router.refresh()
      } else {
        setDone(true)
        setLoading(false)
      }
    } catch (err) {
      if (err instanceof ApiError && err.details) setErrors(Object.fromEntries(Object.entries(err.details).map(([k, v]) => [k, v?.[0]])))
      setError(err instanceof ApiError ? err.message : 'Registration failed.')
      setLoading(false)
    }
  }
  if (done)
    return (
      <div>
        <h1 className="display-md">Check your inbox</h1>
        <p className="mt-3 text-sm text-ink-2">If this email can be used, you will receive a message with next steps. If you already have an account, sign in instead.</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    )
  return (
    <div>
      <h1 className="display-md">Create your account</h1>
      <p className="mt-2 text-sm text-ink-2">Free. Classic mode works without any AI setup.</p>
      {error && !Object.keys(errors).length && (
        <p role="alert" className="mt-5 rounded-[10px] border border-bad/40 bg-bad/10 px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}
      {google && (
        <>
          <div className="mt-6">
            <GoogleButton next={next} label="Sign up with Google" />
          </div>
          <Divider />
        </>
      )}
      <form onSubmit={submit} className={google ? 'space-y-4' : 'mt-6 space-y-4'} noValidate>
        <Field label="Name" error={errors.name}>{(p) => <Input {...p} autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
        <Field label="Email" error={errors.email}>{(p) => <Input {...p} type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
        <Field label="Password" hint="At least 10 characters, mixing letters with numbers or symbols." error={errors.password}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        Already have an account?{' '}
        <Link href="/login" className="text-gold hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}

export function ForgotForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sent' | 'unavailable'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const r = await api<{ emailAvailable: boolean }>('/api/auth/forgot', { body: { email } })
      setState(r.emailAvailable ? 'sent' : 'unavailable')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed.')
    } finally {
      setLoading(false)
    }
  }
  if (state !== 'idle')
    return (
      <div>
        <h1 className="display-md">{state === 'sent' ? 'Check your email' : 'Email is not configured'}</h1>
        <p className="mt-3 text-sm text-ink-2">
          {state === 'sent' ? 'If an account exists for that address, a reset link is on its way. It expires in 30 minutes and works once.' : 'This server cannot send email, so password reset by email is unavailable. Contact the site operator for help.'}
        </p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    )
  return (
    <div>
      <h1 className="display-md">Reset your password</h1>
      <p className="mt-2 text-sm text-ink-2">Enter your email and we will send a single-use reset link.</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Email" error={error}>{(p) => <Input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Button type="submit" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>
    </div>
  )
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api('/api/auth/reset', { body: { token, password } })
      router.replace('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed.')
      setLoading(false)
    }
  }
  return (
    <div>
      <h1 className="display-md">Choose a new password</h1>
      <p className="mt-2 text-sm text-ink-2">This signs you out of every other device.</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="New password" hint="At least 10 characters, mixing letters with numbers or symbols." error={error}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Save password
        </Button>
      </form>
    </div>
  )
}

export function VerifyEmail({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  async function confirm() {
    setLoading(true)
    try {
      await api('/api/auth/verify', { body: { token } })
      setState('ok')
    } catch (err) {
      setState('error')
      setMsg(err instanceof ApiError ? err.message : 'Confirmation failed.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div>
      <h1 className="display-md">{state === 'ok' ? 'Email confirmed' : 'Confirm your email'}</h1>
      <p className="mt-3 text-sm text-ink-2">{state === 'ok' ? 'Thanks. Your address is verified.' : state === 'error' ? msg : 'Press the button to confirm this address belongs to you.'}</p>
      {state === 'ok' ? (
        <Button asChild className="mt-6">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      ) : (
        <Button className="mt-6" onClick={confirm} loading={loading} disabled={!token}>
          Confirm email
        </Button>
      )}
    </div>
  )
}
