import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { Panel } from '@/components/ui/misc'
import { LessonQuiz } from '@/components/app/lesson-quiz'
import { StartButton } from '@/components/play/start-button'
import { requireUser } from '@/server/auth/guard'
import { getLesson } from '@/server/services/training'

export const metadata: Metadata = { title: 'Lesson' }

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser()
  const lesson = await getLesson((await params).slug, user.id)
  if (!lesson) notFound()
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-8">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3">
        <Link href="/training" className="hover:text-ink">
          Academy
        </Link>
        <span className="mx-2">/</span>
        {lesson.program?.title}
      </nav>
      <h1 className="display-lg mt-4">{lesson.title}</h1>
      <p className="mt-2 text-sm text-ink-3">{lesson.minutes}-minute lesson</p>
      <ol className="mt-8 space-y-4">
        {lesson.cards.map((c, i) => (
          <li key={c.heading} className="panel flex gap-4 p-5">
            <span className="tabular font-display text-2xl leading-none text-gold">{i + 1}</span>
            <div>
              <h2 className="font-sans text-[15px] font-semibold text-ink">{c.heading}</h2>
              <p className="mt-1 text-[15px] text-ink-2">{c.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <Panel className="mt-8">
        <h2 className="font-display text-2xl">Worked example</h2>
        <p className="mt-2 text-sm text-ink-2">{lesson.example.setup}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[12px] border border-bad/30 bg-bad/5 p-4">
            <p className="inline-flex items-center gap-1.5 text-[12.5px] text-bad">
              <ThumbsDown className="size-3.5" aria-hidden /> Weaker
            </p>
            <p className="mt-2 text-[15px] text-ink">{lesson.example.weak}</p>
          </div>
          <div className="rounded-[12px] border border-ok/30 bg-ok/5 p-4">
            <p className="inline-flex items-center gap-1.5 text-[12.5px] text-ok">
              <ThumbsUp className="size-3.5" aria-hidden /> Stronger
            </p>
            <p className="mt-2 text-[15px] text-ink">{lesson.example.strong}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-ink-2">{lesson.example.why}</p>
      </Panel>
      <Panel className="mt-8">
        <LessonQuiz slug={lesson.slug} question={lesson.quiz.question} options={lesson.quiz.options} done={lesson.done} />
      </Panel>
      {lesson.practice && (
        <div className="panel mt-8 flex flex-col gap-4 border-gold/40 p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-[13px] text-ink-3">Practise it</p>
            <p className="font-display text-xl">{lesson.practice.title}</p>
            <p className="text-[13px] text-ink-3">About {lesson.practice.estMinutes} minutes, Classic mode</p>
          </div>
          <StartButton input={{ slug: lesson.practice.slug, mode: 'CLASSIC', variant: 'ACADEMY', lessonSlug: lesson.slug }}>Start practice</StartButton>
        </div>
      )}
      {lesson.next && (
        <p className="mt-8 text-sm">
          Next lesson:{' '}
          <Link href={`/training/${lesson.next.slug}`} className="text-gold hover:underline">
            {lesson.next.title}
          </Link>
        </p>
      )}
    </div>
  )
}
