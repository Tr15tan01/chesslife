import 'server-only'
import { DIMENSION_LABELS, type Evaluation } from '@/lib/negotiation/types'
import { getDb } from '../db'
import { isDuplicateKeyError } from '../db/collection'
import type { GameDoc } from '../db/models'
import type { SessionUser } from '../auth/session'
import { checkChallenge, evaluateGame, weakestDimension } from '../engine/evaluate'
import type { ScenarioContext } from '../engine/utility'
import { aiEvaluate } from '../ai/evaluator'
import { AiUnavailableError } from '../ai/providers'
import { aiAvailable, getFlags } from './flags'
import { recordUsage } from './usage'
import { logError } from './logging'

const DAY = (d: Date) => d.toISOString().slice(0, 10)

export function nextStreak(prev: { current: number; best: number; lastDay: string | null }, day: string) {
  if (prev.lastDay === day) return prev
  const yesterday = DAY(new Date(new Date(`${day}T00:00:00Z`).getTime() - 86400000))
  const current = prev.lastDay === yesterday ? prev.current + 1 : 1
  return { current, best: Math.max(prev.best, current), lastDay: day }
}

async function recommend(userId: string, e: Evaluation, excludeSlug: string): Promise<Evaluation['recommended']> {
  const db = await getDb()
  const weak = weakestDimension(e)
  const recent = await db.games.find({ userId }, { sort: { createdAt: -1 }, limit: 8, projection: { scenarioSlug: 1 } })
  const avoid = new Set([excludeSlug, ...recent.map((g) => g.scenarioSlug)])
  const candidates = await db.scenarios.find({ visibility: 'PUBLIC', published: true, focus: weak } as never, { limit: 40, sort: { difficulty: 1 } })
  const pick = candidates.find((c) => !avoid.has(c.slug)) ?? candidates.find((c) => c.slug !== excludeSlug)
  if (!pick) return null
  return { slug: pick.slug, title: pick.title, reason: `Practises ${DIMENSION_LABELS[weak].toLowerCase()}, your lowest-scoring area this time.` }
}

/**
 * Completes a finished game exactly once:
 *  - the evaluation document uses the game id as its _id (duplicate inserts are ignored)
 *  - progress is applied behind a `progressApplied` compare-and-set
 * This gives transaction-like guarantees without requiring multi-document
 * transactions (which also work on Atlas, but not on the in-memory store).
 */
export async function completeGame(user: SessionUser, game: GameDoc, ctx: ScenarioContext): Promise<Evaluation> {
  const db = await getDb()
  const existing = await db.evaluations.findOne({ _id: game._id })
  if (existing) return existing.evaluation

  let evaluation = evaluateGame({ ctx, state: game.state, turns: game.turns, prep: game.prep, outcome: game.outcome ?? { kind: 'NO_DEAL', terms: null } })

  if (game.challengeSlug) {
    const ch = await db.challenges.findOne({ slug: game.challengeSlug })
    if (ch) {
      const criteria = checkChallenge(evaluation, ch.criteria, ctx)
      evaluation.challenge = { slug: ch.slug, title: ch.title, passed: criteria.every((c) => c.met), criteria }
    }
  }

  if (game.mode === 'AI' && (await aiAvailable()) && (await getFlags()).aiEvaluation.enabled) {
    try {
      const ai = await aiEvaluate(ctx.pub, game.turns, evaluation)
      if (ai) {
        evaluation = { ...ai.evaluation, challenge: evaluation.challenge }
        await recordUsage(user.id, 'AI_EVAL', ai.usage, true)
      }
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) await logError('evaluation', err, game._id, user.id)
      // Rules-based evaluation stands on its own.
    }
  }

  evaluation.recommended = await recommend(user.id, evaluation, game.scenarioSlug)

  try {
    await db.evaluations.insertOne({
      _id: game._id,
      userId: user.id,
      gameId: game._id,
      scenarioSlug: game.scenarioSlug,
      category: game.category,
      difficulty: game.difficulty,
      mode: game.mode,
      variant: game.variant,
      evaluation,
      createdAt: new Date(),
    })
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err
    const again = await db.evaluations.findOne({ _id: game._id })
    return again!.evaluation
  }

  const claimed = await db.games.findOneAndUpdate({ _id: game._id, userId: user.id, progressApplied: false }, { $set: { progressApplied: true, score: evaluation.overall } })
  if (claimed) {
    const prev = (await db.progress.findOne({ _id: user.id })) ?? {
      _id: user.id,
      gamesCompleted: 0,
      agreements: 0,
      walkAways: 0,
      bestScore: 0,
      streak: { current: 0, best: 0, lastDay: null },
      activeDays: [],
      challengesPassed: [],
      updatedAt: new Date(),
    }
    const day = DAY(new Date())
    const passed = evaluation.challenge?.passed && !prev.challengesPassed.includes(evaluation.challenge.slug)
    await db.progress.replaceOne(
      { _id: user.id },
      {
        ...prev,
        gamesCompleted: prev.gamesCompleted + 1,
        agreements: prev.agreements + (evaluation.facts.outcome === 'AGREEMENT' ? 1 : 0),
        walkAways: prev.walkAways + (evaluation.facts.outcome === 'PLAYER_WALKED' ? 1 : 0),
        bestScore: Math.max(prev.bestScore, evaluation.overall),
        streak: nextStreak(prev.streak, day),
        activeDays: [...new Set([...prev.activeDays, day])].slice(-120),
        challengesPassed: passed ? [...prev.challengesPassed, evaluation.challenge!.slug] : prev.challengesPassed,
        updatedAt: new Date(),
      },
      { upsert: true },
    )
  }
  return evaluation
}

export async function getEvaluation(userId: string, gameId: string): Promise<Evaluation | null> {
  const db = await getDb()
  const doc = await db.evaluations.findOne({ _id: gameId, userId })
  return doc?.evaluation ?? null
}

/** Record a day of activity from lessons too (for the streak). */
export async function markActiveDay(userId: string) {
  const db = await getDb()
  const prev = await db.progress.findOne({ _id: userId })
  const day = DAY(new Date())
  const base = prev ?? { _id: userId, gamesCompleted: 0, agreements: 0, walkAways: 0, bestScore: 0, streak: { current: 0, best: 0, lastDay: null }, activeDays: [], challengesPassed: [], updatedAt: new Date() }
  await db.progress.replaceOne({ _id: userId }, { ...base, streak: nextStreak(base.streak, day), activeDays: [...new Set([...base.activeDays, day])].slice(-120), updatedAt: new Date() }, { upsert: true })
}
