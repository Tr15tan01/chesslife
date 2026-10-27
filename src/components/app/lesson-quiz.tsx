'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export function LessonQuiz({ slug, question, options, done }: { slug: string; question: string; options: string[]; done: boolean }) {
  const router = useRouter()
  const [pick, setPick] = useState<number | null>(null)
  const [result, setResult] = useState<{ correct: boolean; explain: string } | null>(null)
  const [busy, setBusy] = useState(false)
  async function check() {
    if (pick === null) return
    setBusy(true)
    try {
      const r = await api<{ correct: boolean; explain: string }>(`/api/training/lessons/${slug}/answer`, { body: { answer: pick } })
      setResult(r)
      if (r.correct) router.refresh()
    } finally {
      setBusy(false)
    }
  }
  return (
    <fieldset className="space-y-3">
      <legend className="font-display text-xl">{question}</legend>
      {done && !result && <p className="text-[13px] text-ok">You have completed this lesson. Answer again any time.</p>}
      <div className="space-y-2" role="radiogroup">
        {options.map((o, i) => (
          <label key={o} className={cn('flex cursor-pointer items-center gap-3 rounded-[12px] border px-4 py-3 text-sm transition-colors', pick === i ? 'border-gold bg-gold/10' : 'border-line hover:border-line-strong')}>
            <input type="radio" name="quiz" className="accent-[var(--gold)]" checked={pick === i} onChange={() => { setPick(i); setResult(null) }} />
            {o}
          </label>
        ))}
      </div>
      <Button onClick={check} disabled={pick === null} loading={busy}>
        Check answer
      </Button>
      {result && (
        <p role="status" className={cn('flex gap-2 rounded-[12px] p-3 text-sm', result.correct ? 'bg-ok/10 text-ink' : 'bg-bad/10 text-ink')}>
          {result.correct ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />}
          {result.correct ? `Correct. ${result.explain}` : result.explain}
        </p>
      )}
    </fieldset>
  )
}
