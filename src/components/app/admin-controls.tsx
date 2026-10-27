'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/lib/api-client'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { DIMENSIONS, DIMENSION_LABELS, type Dimension } from '@/lib/negotiation/types'

function useMutate() {
  const router = useRouter()
  const toast = useToast()
  return async (path: string, method: string, body: unknown, ok = 'Saved.') => {
    try {
      await api(path, { method, body })
      toast(ok, 'ok')
      router.refresh()
      return true
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action failed.', 'bad')
      return false
    }
  }
}

export function UserRow({ id, role, status, self }: { id: string; role: string; status: string; self: boolean }) {
  const mutate = useMutate()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Role" disabled={self} defaultValue={role} onChange={(e) => mutate(`/api/admin/users/${id}`, 'PATCH', { role: e.target.value }, 'Role updated. Their sessions were signed out.')} className="h-8 rounded-full border border-line bg-surface px-2.5 text-[13px] text-ink-2 disabled:opacity-50">
        <option value="USER">User</option>
        <option value="CONTENT_MANAGER">Content manager</option>
        <option value="ADMIN">Admin</option>
      </select>
      <Button size="sm" variant={status === 'ACTIVE' ? 'ghost' : 'secondary'} disabled={self} onClick={() => mutate(`/api/admin/users/${id}`, 'PATCH', { status: status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }, status === 'ACTIVE' ? 'User suspended.' : 'User reactivated.')}>
        {status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
      </Button>
    </div>
  )
}

export function PublishToggle({ path, published }: { path: string; published: boolean }) {
  const mutate = useMutate()
  return (
    <Button size="sm" variant={published ? 'ghost' : 'secondary'} onClick={() => mutate(path, 'PATCH', { published: !published }, published ? 'Unpublished.' : 'Published.')}>
      {published ? 'Unpublish' : 'Publish'}
    </Button>
  )
}

export function ScenarioEditor({ slug, initial }: { slug: string; initial: { title: string; summary: string; difficulty: number; tags: string[]; weights: Record<Dimension, number> } }) {
  const mutate = useMutate()
  const [f, setF] = useState({ ...initial, tags: initial.tags.join(', ') })
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        await mutate(`/api/admin/scenarios/${slug}`, 'PATCH', { title: f.title, summary: f.summary, difficulty: Number(f.difficulty), tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), weights: f.weights }, 'Saved as a new scenario version.')
        setBusy(false)
      }}
    >
      <Field label="Title">{(p) => <Input {...p} value={f.title} maxLength={100} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
      <Field label="Summary">{(p) => <Input {...p} value={f.summary} maxLength={240} onChange={(e) => setF({ ...f, summary: e.target.value })} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Difficulty (1–4)">{(p) => <Input {...p} type="number" min={1} max={4} value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: Number(e.target.value) })} />}</Field>
        <Field label="Tags (comma separated)">{(p) => <Input {...p} value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} />}</Field>
      </div>
      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2">Scoring weights (0.5–5)</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DIMENSIONS.map((d) => (
            <Field key={d} label={DIMENSION_LABELS[d]}>
              {(p) => <Input {...p} type="number" step={0.5} min={0.5} max={5} value={f.weights[d]} onChange={(e) => setF({ ...f, weights: { ...f.weights, [d]: Number(e.target.value) } })} />}
            </Field>
          ))}
        </div>
      </fieldset>
      <Button type="submit" loading={busy}>
        Save new version
      </Button>
      <p className="text-[12.5px] text-ink-3">Edits create a new version. Games already played keep the version they used.</p>
    </form>
  )
}

export function FlagRow({ k, label, enabled, value }: { k: string; label: string; enabled: boolean; value?: number }) {
  const mutate = useMutate()
  const [v, setV] = useState(value)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="text-sm text-ink">{label}</span>
      <div className="flex items-center gap-2">
        {value !== undefined && <Input aria-label={`${label} value`} type="number" className="h-8 w-24" value={v} onChange={(e) => setV(Number(e.target.value))} onBlur={() => mutate('/api/admin/flags', 'PUT', { key: k, enabled, value: v })} />}
        <label className="inline-flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" role="switch" className="size-4 accent-[var(--gold)]" checked={enabled} onChange={(e) => mutate('/api/admin/flags', 'PUT', { key: k, enabled: e.target.checked, value: v })} />
          {enabled ? 'On' : 'Off'}
        </label>
      </div>
    </div>
  )
}
