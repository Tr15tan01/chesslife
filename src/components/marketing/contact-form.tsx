'use client'

import { useState, type FormEvent } from 'react'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'

export function ContactForm() {
  const [f, setF] = useState({ name: '', email: '', topic: 'general', message: '', website: '' })
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [state, setState] = useState<'idle' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setError(null)
    try {
      await api('/api/contact', { body: f })
      setState('sent')
    } catch (err) {
      if (err instanceof ApiError && err.details) setErrors(Object.fromEntries(Object.entries(err.details).map(([k, v]) => [k, v?.[0]])))
      else setError(err instanceof Error ? err.message : 'Could not send.')
    } finally {
      setBusy(false)
    }
  }
  if (state === 'sent') return <p className="panel p-6 text-ink">Message received. We reply to most messages within two working days.</p>
  return (
    <form onSubmit={submit} className="panel space-y-4 p-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name}>{(p) => <Input {...p} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="Email" error={errors.email}>{(p) => <Input {...p} type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
      </div>
      <Field label="Topic">
        {(p) => (
          <Select {...p} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>
            <option value="general">General question</option>
            <option value="support">Account support</option>
            <option value="privacy">Privacy request</option>
            <option value="partnership">Teams and partnerships</option>
          </Select>
        )}
      </Field>
      <Field label="Message" error={errors.message}>{(p) => <Textarea {...p} maxLength={2000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />}</Field>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <Button type="submit" loading={busy}>
        Send message
      </Button>
    </form>
  )
}
