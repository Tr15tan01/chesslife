import 'server-only'
import { z } from 'zod'
import { CATEGORIES, DIMENSIONS, type Category, type Dimension, type GameMode } from '@/lib/negotiation/types'
import { tipFor } from '@/lib/tips'
import { getDb } from '../db'
import type { EvaluationDoc } from '../db/models'
import { aiAvailable } from './flags'

/**
 * All analytics are computed from persisted evaluations and games for the
 * requesting user only. No demo numbers.
 */

export const progressQuerySchema = z.object({
  range: z.enum(['30', '90', '365', 'all']).default('90'),
  category: z.enum(CATEGORIES).optional(),
  mode: z.enum(['CLASSIC', 'AI']).optional(),
})

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

function weekKey(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = x.getUTCDay() || 7
  x.setUTCDate(x.getUTCDate() - day + 1)
  return x.toISOString().slice(0, 10)
}

function lastWeeks(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) out.push(weekKey(new Date(now.getTime() - i * 7 * 86400000)))
  return out
}

export function summarise() {
  const dimAvg = (rows: EvaluationDoc[]) => Object.fromEntries(DIMENSIONS.map((d) => [d, avg(rows.map((e) => e.evaluation.dimensions[d].score))])) as Record<Dimension, number | null>
  const outcomes = (rows: EvaluationDoc[]) => ({
    agreements: rows.filter((e) => e.evaluation.facts.outcome === 'AGREEMENT').length,
    walkAways: rows.filter((e) => e.evaluation.facts.outcome === 'PLAYER_WALKED').length,
    noDeal: rows.filter((e) => !['AGREEMENT', 'PLAYER_WALKED'].includes(e.evaluation.facts.outcome)).length,
  })
  return { dimAvg, outcomes }
}

export async function getProgress(userId: string, q: z.infer<typeof progressQuerySchema>) {
  const db = await getDb()
  const filter: Record<string, unknown> = { userId }
  if (q.range !== 'all') filter.createdAt = { $gte: new Date(Date.now() - Number(q.range) * 86400000) }
  if (q.category) filter.category = q.category
  if (q.mode) filter.mode = q.mode
  const evals = await db.evaluations.find(filter as never, { sort: { createdAt: 1 }, limit: 500 })
  const lessonFilter: Record<string, unknown> = { userId }
  if (q.range !== 'all') lessonFilter.completedAt = { $gte: new Date(Date.now() - Number(q.range) * 86400000) }
  const lessons = await db.lessonCompletions.find(lessonFilter as never, { limit: 1000 })
  const titles = new Map((await db.games.find({ _id: { $in: evals.map((e) => e._id) } } as never, { projection: { _id: 1, scenarioTitle: 1 } })).map((g) => [g._id, g.scenarioTitle]))
  const { dimAvg, outcomes } = summarise()

  const overTime = evals.map((e) => ({
    gameId: e._id,
    date: e.createdAt.toISOString(),
    title: titles.get(e._id) ?? e.scenarioSlug,
    overall: e.evaluation.overall,
    outcome: e.evaluation.dimensions.outcome.score,
    mode: e.mode,
    concessions: e.evaluation.facts.concessions,
  }))

  const rulesOnly = evals.filter((e) => !e.evaluation.aiAssessed)
  const aiAssessed = evals.filter((e) => e.evaluation.aiAssessed)

  const byCategory = CATEGORIES.map((c) => {
    const rows = evals.filter((e) => e.category === c)
    return { category: c, games: rows.length, avgScore: avg(rows.map((e) => e.evaluation.overall)), ...outcomes(rows) }
  }).filter((r) => r.games > 0)

  const byDifficulty = [1, 2, 3, 4].map((d) => {
    const rows = evals.filter((e) => e.difficulty === d)
    return { difficulty: d, games: rows.length, avgScore: avg(rows.map((e) => e.evaluation.overall)) }
  })

  const byMode = (['CLASSIC', 'AI'] as GameMode[]).map((m) => {
    const rows = evals.filter((e) => e.mode === m)
    return { mode: m, games: rows.length, avgScore: avg(rows.map((e) => e.evaluation.overall)), agreementRate: rows.length ? Math.round((outcomes(rows).agreements / rows.length) * 100) : null }
  })

  const weeks = lastWeeks(q.range === '30' ? 5 : 12)
  const training = weeks.map((w) => ({
    week: w,
    games: evals.filter((e) => weekKey(e.createdAt) === w).length,
    lessons: lessons.filter((l) => weekKey(l.completedAt) === w).length,
  }))

  const o = outcomes(evals)
  return {
    totals: {
      games: evals.length,
      agreementRate: evals.length ? Math.round((o.agreements / evals.length) * 100) : null,
      walkAways: o.walkAways,
      avgConcessions: evals.length ? Number((evals.reduce((s, e) => s + e.evaluation.facts.concessions, 0) / evals.length).toFixed(1)) : null,
      avgScore: avg(evals.map((e) => e.evaluation.overall)),
      lessons: lessons.length,
    },
    overTime,
    dimensions: DIMENSIONS.map((d) => ({ dimension: d, all: dimAvg(evals)[d], rulesOnly: dimAvg(rulesOnly)[d], aiAssessed: dimAvg(aiAssessed)[d] })),
    aiAssessedGames: aiAssessed.length,
    byCategory,
    byDifficulty,
    byMode,
    training,
  }
}

export async function getDashboard(userId: string) {
  const db = await getDb()
  const [recentGames, progress, evals, active, completions, totalLessons, ai] = await Promise.all([
    db.games.find({ userId }, { sort: { createdAt: -1 }, limit: 5, projection: { _id: 1, scenarioTitle: 1, scenarioSlug: 1, status: 1, score: 1, mode: 1, createdAt: 1, category: 1 } }),
    db.progress.findOne({ _id: userId }),
    db.evaluations.find({ userId }, { sort: { createdAt: -1 }, limit: 20 }),
    db.games.find({ userId, status: { $in: ['CREATED', 'ACTIVE', 'PAUSED'] } } as never, { sort: { updatedAt: -1 }, limit: 3, projection: { _id: 1, scenarioTitle: 1, status: 1, mode: 1, updatedAt: 1 } }),
    db.lessonCompletions.find({ userId }, { projection: { lessonId: 1, completedAt: 1 } }),
    db.lessons.countDocuments({ published: true }),
    aiAvailable(),
  ])
  const last10 = evals.slice(0, 10)
  const dims = DIMENSIONS.map((d) => ({ dimension: d, score: avg(last10.map((e) => e.evaluation.dimensions[d].score)) }))
  const ranked = dims.filter((d) => d.score !== null).sort((a, b) => a.score! - b.score!)
  const weakest = ranked.slice(0, 2).map((d) => d.dimension)
  const strongest = ranked[ranked.length - 1]?.dimension ?? null

  const played = new Set((await db.games.find({ userId }, { projection: { scenarioSlug: 1 }, limit: 500 })).map((g) => g.scenarioSlug))
  const focus = weakest.length ? weakest : (['information', 'offers'] as Dimension[])
  const pool = await db.scenarios.find({ visibility: 'PUBLIC', published: true, focus: { $in: focus } } as never, { sort: { difficulty: 1 }, limit: 40, projection: { _id: 0, slug: 1, title: 1, summary: 1, category: 1, difficulty: 1, estMinutes: 1, quick: 1, focus: 1 } })
  const suggested = [...pool.filter((s) => !played.has(s.slug)), ...pool.filter((s) => played.has(s.slug))].slice(0, 3)

  const doneIds = new Set(completions.map((c) => c.lessonId))
  const nextLesson = (await db.lessons.find({ published: true }, { sort: { order: 1 }, limit: 100 }))
    .map((l) => l)
    .sort((a, b) => a.programId.localeCompare(b.programId) || a.order - b.order)
  const programs = await db.programs.find({ published: true }, { sort: { order: 1 } })
  const orderedLessons = programs.flatMap((p) => nextLesson.filter((l) => l.programId === p._id))
  const upcoming = orderedLessons.find((l) => !doneIds.has(l._id)) ?? null

  const trend = [...evals].reverse().map((e) => ({ date: e.createdAt.toISOString(), overall: e.evaluation.overall, outcome: e.evaluation.dimensions.outcome.score }))
  const firstHalf = avg(trend.slice(0, Math.floor(trend.length / 2)).map((t) => t.overall))
  const secondHalf = avg(trend.slice(Math.floor(trend.length / 2)).map((t) => t.overall))

  const seed = new Date().getUTCDate() + (progress?.gamesCompleted ?? 0)
  const tips = (weakest.length ? weakest : (['information', 'offers'] as Dimension[])).map((d) => ({ dimension: d, tip: tipFor(d, seed) }))

  const weeks = lastWeeks(8)
  const activity = weeks.map((w) => ({
    week: w,
    games: evals.filter((e) => weekKey(e.createdAt) === w).length,
    lessons: completions.filter((c) => weekKey(c.completedAt) === w).length,
  }))

  return {
    aiAvailable: ai,
    progress: {
      gamesCompleted: progress?.gamesCompleted ?? 0,
      agreements: progress?.agreements ?? 0,
      walkAways: progress?.walkAways ?? 0,
      bestScore: progress?.bestScore ?? 0,
      streak: progress?.streak ?? { current: 0, best: 0, lastDay: null },
      challengesPassed: progress?.challengesPassed.length ?? 0,
      lessonsDone: doneIds.size,
      totalLessons,
      activeDays: progress?.activeDays ?? [],
    },
    recent: recentGames.map((g) => ({ id: g._id, title: g.scenarioTitle, slug: g.scenarioSlug, status: g.status, score: g.score, mode: g.mode, createdAt: g.createdAt.toISOString(), category: g.category as Category })),
    active: active.map((g) => ({ id: g._id, title: g.scenarioTitle, status: g.status, mode: g.mode, updatedAt: g.updatedAt.toISOString() })),
    dims,
    weakest,
    strongest,
    trend,
    trendDelta: firstHalf !== null && secondHalf !== null && trend.length >= 4 ? secondHalf - firstHalf : null,
    suggested,
    upcomingLesson: upcoming ? { slug: upcoming.slug, title: upcoming.title, minutes: upcoming.minutes, program: programs.find((p) => p._id === upcoming.programId)?.title ?? '' } : null,
    tips,
    activity,
  }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>
export type ProgressData = Awaited<ReturnType<typeof getProgress>>
