import 'server-only'
import { getDb } from '../db'
import { isDuplicateKeyError } from '../db/collection'
import { Errors } from '../http'
import { markActiveDay } from './completion'

export async function listPrograms(userId: string | null) {
  const db = await getDb()
  const [programs, lessons, done] = await Promise.all([
    db.programs.find({ published: true }, { sort: { order: 1 } }),
    db.lessons.find({ published: true }, { sort: { order: 1 }, projection: { _id: 1, slug: 1, title: 1, programId: 1, order: 1, minutes: 1, practiceScenario: 1 } }),
    userId ? db.lessonCompletions.find({ userId }, { projection: { lessonId: 1 } }) : Promise.resolve([]),
  ])
  const doneIds = new Set(done.map((d) => d.lessonId))
  return programs.map((p) => {
    const ls = lessons.filter((l) => l.programId === p._id).sort((a, b) => a.order - b.order)
    return {
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      skill: p.skill,
      order: p.order,
      lessons: ls.map((l) => ({ slug: l.slug, title: l.title, minutes: l.minutes, practiceScenario: l.practiceScenario, done: doneIds.has(l._id) })),
      completed: ls.filter((l) => doneIds.has(l._id)).length,
    }
  })
}

export async function getLesson(slug: string, userId: string | null) {
  const db = await getDb()
  const lesson = await db.lessons.findOne({ slug, published: true })
  if (!lesson) return null
  const program = await db.programs.findOne({ _id: lesson.programId })
  const done = userId ? Boolean(await db.lessonCompletions.findOne({ userId, lessonId: lesson._id })) : false
  const siblings = await db.lessons.find({ programId: lesson.programId, published: true }, { sort: { order: 1 }, projection: { slug: 1, title: 1, order: 1 } })
  const idx = siblings.findIndex((s) => s.slug === slug)
  const practice = lesson.practiceScenario ? await db.scenarios.findOne({ slug: lesson.practiceScenario }, { projection: { slug: 1, title: 1, estMinutes: 1 } }) : null
  return {
    slug: lesson.slug,
    title: lesson.title,
    minutes: lesson.minutes,
    cards: lesson.cards,
    example: lesson.example,
    quiz: { question: lesson.quiz.question, options: lesson.quiz.options },
    program: program ? { slug: program.slug, title: program.title } : null,
    practice: practice ? { slug: practice.slug, title: practice.title, estMinutes: practice.estMinutes } : null,
    next: siblings[idx + 1] ? { slug: siblings[idx + 1]!.slug, title: siblings[idx + 1]!.title } : null,
    done,
  }
}

/** The quiz answer is checked server-side; the correct index is never sent before answering. */
export async function answerLesson(userId: string, slug: string, answer: number) {
  const db = await getDb()
  const lesson = await db.lessons.findOne({ slug, published: true })
  if (!lesson) throw Errors.notFound('Lesson')
  const correct = lesson.quiz.answer === answer
  if (correct) {
    try {
      await db.lessonCompletions.insertOne({ _id: crypto.randomUUID(), userId, lessonId: lesson._id, programId: lesson.programId, completedAt: new Date() })
      await markActiveDay(userId)
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err
    }
  }
  return { correct, correctIndex: correct ? answer : null, explain: correct ? lesson.quiz.explain : 'Not quite. Re-read the cards above and try again.' }
}

export async function listChallenges(userId: string | null) {
  const db = await getDb()
  const [challenges, progress, scenarios] = await Promise.all([
    db.challenges.find({ published: true }, { sort: { order: 1 } }),
    userId ? db.progress.findOne({ _id: userId }) : null,
    db.scenarios.find({ visibility: 'PUBLIC' }, { projection: { slug: 1, title: 1, difficulty: 1 } }),
  ])
  const passed = new Set(progress?.challengesPassed ?? [])
  return challenges.map((c, i) => ({
    slug: c.slug,
    title: c.title,
    summary: c.summary,
    criteriaText: c.criteriaText,
    order: c.order,
    scenario: scenarios.find((s) => s.slug === c.scenarioSlug) ?? null,
    passed: passed.has(c.slug),
    // Challenges unlock in order; the first two are always open.
    unlocked: i < 2 || passed.has(challenges[i - 1]!.slug) || passed.size >= i,
  }))
}

export async function isChallengeUnlocked(userId: string, slug: string): Promise<boolean> {
  const list = await listChallenges(userId)
  return Boolean(list.find((c) => c.slug === slug)?.unlocked)
}
