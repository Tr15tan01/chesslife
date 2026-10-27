'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { DIFFICULTY_LABELS, type Difficulty } from '@/lib/negotiation/types'
import { Dialog, DialogClose } from '@/components/ui/dialog'

type IssueForm = { label: string; unit: string; prefers: 'higher' | 'lower'; min: string; max: string; target: string; limit: string }
const blankIssue = (): IssueForm => ({ label: 'Price', unit: 'currency', prefers: 'lower', min: '1000', max: '5000', target: '2500', limit: '3800' })

export function CustomBuilder({ aiAvailable }: { aiAvailable: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [f, setF] = useState({ title: '', context: '', role: '', counterpartRole: '', objectives: '', desiredOutcome: '', difficulty: 2 as Difficulty, timeLimitMin: '', useAi: false })
  const [issues, setIssues] = useState<IssueForm[]>([blankIssue()])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }))
  const setIssue = (i: number, k: keyof IssueForm, v: string) => setIssues((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = {
        ...f,
        timeLimitMin: f.timeLimitMin ? Number(f.timeLimitMin) : undefined,
        issues: issues.map((i) => ({ label: i.label, unit: i.unit, prefers: i.prefers, min: Number(i.min), max: Number(i.max), target: Number(i.target), limit: Number(i.limit) })),
      }
      const r = await api<{ slug: string; aiFlavour: boolean }>('/api/scenarios/custom', { body })
      toast(r.aiFlavour ? 'Scenario created with AI-written character details.' : 'Scenario created.', 'ok')
      const g = await api<{ id: string }>('/api/games', { body: { slug: r.slug, mode: 'CLASSIC', variant: 'CUSTOM', timed: Boolean(f.timeLimitMin) } })
      router.push(`/play/${g.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the scenario.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title">{(p) => <Input {...p} required maxLength={80} placeholder="e.g. Renewing my agency contract" value={f.title} onChange={(e) => set('title', e.target.value)} />}</Field>
        <Field label="Difficulty">
          {(p) => (
            <Select {...p} value={f.difficulty} onChange={(e) => set('difficulty', Number(e.target.value))}>
              {[1, 2, 3, 4].map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d as Difficulty]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Context" className="md:col-span-2" hint="What is happening and why this conversation matters.">
          {(p) => <Textarea {...p} required maxLength={800} value={f.context} onChange={(e) => set('context', e.target.value)} />}
        </Field>
        <Field label="Your role">{(p) => <Input {...p} required maxLength={80} placeholder="e.g. Freelance designer" value={f.role} onChange={(e) => set('role', e.target.value)} />}</Field>
        <Field label="The other party’s role">{(p) => <Input {...p} required maxLength={80} placeholder="e.g. Marketing director at the client" value={f.counterpartRole} onChange={(e) => set('counterpartRole', e.target.value)} />}</Field>
        <Field label="Your objectives">{(p) => <Textarea {...p} required maxLength={300} className="min-h-20" value={f.objectives} onChange={(e) => set('objectives', e.target.value)} />}</Field>
        <Field label="Desired outcome">{(p) => <Textarea {...p} required maxLength={300} className="min-h-20" value={f.desiredOutcome} onChange={(e) => set('desiredOutcome', e.target.value)} />}</Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-display text-xl">What is being negotiated</legend>
        <p className="text-sm text-ink-3">Add up to three issues. Your limit is the worst you would accept; your target is what you are aiming for.</p>
        {issues.map((iss, i) => (
          <div key={i} className="grid gap-3 rounded-[12px] border border-line p-4 sm:grid-cols-2 lg:grid-cols-7">
            <Field label="Issue" className="lg:col-span-2">{(p) => <Input {...p} maxLength={40} value={iss.label} onChange={(e) => setIssue(i, 'label', e.target.value)} />}</Field>
            <Field label="Unit">
              {(p) => (
                <Select {...p} value={iss.unit} onChange={(e) => setIssue(i, 'unit', e.target.value)}>
                  {['currency', 'percent', 'days', 'weeks', 'months', 'hours', 'count'].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="You want it">
              {(p) => (
                <Select {...p} value={iss.prefers} onChange={(e) => setIssue(i, 'prefers', e.target.value)}>
                  <option value="lower">Lower</option>
                  <option value="higher">Higher</option>
                </Select>
              )}
            </Field>
            <Field label="Range">{(p) => <div className="flex gap-1.5"><Input {...p} aria-label="Minimum" inputMode="decimal" value={iss.min} onChange={(e) => setIssue(i, 'min', e.target.value)} /><Input aria-label="Maximum" inputMode="decimal" value={iss.max} onChange={(e) => setIssue(i, 'max', e.target.value)} /></div>}</Field>
            <Field label="Target">{(p) => <Input {...p} inputMode="decimal" value={iss.target} onChange={(e) => setIssue(i, 'target', e.target.value)} />}</Field>
            <div className="flex items-end gap-2">
              <Field label="Limit" className="flex-1">{(p) => <Input {...p} inputMode="decimal" value={iss.limit} onChange={(e) => setIssue(i, 'limit', e.target.value)} />}</Field>
              {issues.length > 1 && (
                <button type="button" onClick={() => setIssues((xs) => xs.filter((_, j) => j !== i))} className="mb-1 rounded-full p-2 text-ink-3 hover:text-bad" aria-label={`Remove issue ${iss.label}`}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {issues.length < 3 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setIssues((xs) => [...xs, { ...blankIssue(), label: 'Timeline', unit: 'weeks', prefers: 'higher', min: '1', max: '12', target: '8', limit: '4' }])}>
            <Plus className="size-4" aria-hidden /> Add an issue
          </Button>
        )}
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Time limit in minutes (optional)" hint="Leave empty for untimed practice.">
          {(p) => <Input {...p} inputMode="numeric" value={f.timeLimitMin} onChange={(e) => set('timeLimitMin', e.target.value.replace(/\D/g, ''))} />}
        </Field>
        <label className="flex items-start gap-3 self-end rounded-[12px] border border-line p-3 text-sm text-ink-2">
          <input type="checkbox" className="mt-1 accent-[var(--gold)]" disabled={!aiAvailable} checked={f.useAi} onChange={(e) => set('useAi', e.target.checked)} />
          <span>
            Let AI write the character’s name, background and opening line.
            <span className="block text-[12.5px] text-ink-3">{aiAvailable ? 'Numbers and hidden rules are always generated by DealCraft, not the AI. Your context is sent to the AI provider.' : 'AI is not available on this server.'}</span>
          </span>
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-[10px] border border-bad/40 bg-bad/10 px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}
      <Button type="submit" loading={busy}>
        Create and start
      </Button>
    </form>
  )
}

export function DeleteCustom({ slug, title }: { slug: string; title: string }) {
  const router = useRouter()
  return (
    <Dialog
      title="Delete this scenario?"
      description={`“${title}” will be removed. Games you already played stay in your history.`}
      trigger={
        <button type="button" className="rounded-full p-2 text-ink-3 hover:text-bad" aria-label={`Delete ${title}`}>
          <Trash2 className="size-4" />
        </button>
      }
    >
      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Keep it</Button>
        </DialogClose>
        <DialogClose asChild>
          <Button
            variant="danger"
            onClick={async () => {
              await api(`/api/scenarios/custom/${slug}`, { method: 'DELETE' })
              router.refresh()
            }}
          >
            Delete
          </Button>
        </DialogClose>
      </div>
    </Dialog>
  )
}
