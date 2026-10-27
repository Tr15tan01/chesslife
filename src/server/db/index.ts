import 'server-only'
import type { Document } from 'mongodb'
import { env } from '../env'
import type { BaseDoc, Coll, IndexSpec } from './collection'
import { MemoryCollection, registerMemoryIndexes } from './memory'
import { MongoCollection, mongoClient } from './mongo'
import type * as M from './models'

/**
 * Collection registry + index definitions. MongoDB Atlas is the primary
 * database; `memory://` is an in-process store for tests and local demos.
 */

const INDEXES: Record<string, IndexSpec[]> = {
  users: [{ keys: { email: 1 }, unique: true }, { keys: { createdAt: -1 } }, { keys: { role: 1 } }],
  oauth_accounts: [{ keys: { provider: 1, providerAccountId: 1 }, unique: true }, { keys: { userId: 1 } }],
  sessions: [{ keys: { tokenHash: 1 }, unique: true }, { keys: { userId: 1 } }, { keys: { expiresAt: 1 }, expireAfterSeconds: 0 }],
  auth_tokens: [{ keys: { tokenHash: 1 }, unique: true }, { keys: { userId: 1, type: 1 } }, { keys: { expiresAt: 1 }, expireAfterSeconds: 0 }],
  scenarios: [
    { keys: { slug: 1 }, unique: true },
    { keys: { visibility: 1, published: 1, category: 1, difficulty: 1 } },
    { keys: { ownerId: 1 } },
  ],
  scenario_versions: [{ keys: { scenarioId: 1, version: 1 }, unique: true }],
  games: [
    { keys: { userId: 1, createdAt: -1 } },
    { keys: { userId: 1, status: 1, completedAt: -1 } },
    { keys: { userId: 1, challengeSlug: 1 } },
    { keys: { scenarioId: 1 } },
  ],
  evaluations: [{ keys: { userId: 1, createdAt: -1 } }],
  chess_games: [{ keys: { userId: 1, createdAt: -1 } }, { keys: { userId: 1, status: 1 } }],
  user_progress: [],
  training_programs: [{ keys: { slug: 1 }, unique: true }, { keys: { order: 1 } }],
  training_lessons: [{ keys: { slug: 1 }, unique: true }, { keys: { programId: 1, order: 1 } }],
  lesson_completions: [{ keys: { userId: 1, lessonId: 1 }, unique: true }, { keys: { userId: 1, completedAt: -1 } }],
  challenges: [{ keys: { slug: 1 }, unique: true }, { keys: { order: 1 } }],
  user_preferences: [],
  usage_records: [{ keys: { userId: 1, kind: 1, day: 1 } }, { keys: { createdAt: -1 } }],
  audit_logs: [{ keys: { createdAt: -1 } }, { keys: { actorId: 1, createdAt: -1 } }],
  rate_limits: [{ keys: { expiresAt: 1 }, expireAfterSeconds: 0 }],
  feature_flags: [],
  error_logs: [{ keys: { createdAt: 1 }, expireAfterSeconds: 60 * 60 * 24 * 30 }],
  contact_messages: [{ keys: { createdAt: -1 } }],
}

export type Db = {
  users: Coll<M.UserDoc>
  oauthAccounts: Coll<M.OAuthAccountDoc>
  sessions: Coll<M.SessionDoc>
  authTokens: Coll<M.AuthTokenDoc>
  scenarios: Coll<M.ScenarioDoc>
  scenarioVersions: Coll<M.ScenarioVersionDoc>
  games: Coll<M.GameDoc>
  evaluations: Coll<M.EvaluationDoc>
  chessGames: Coll<M.ChessGameDoc>
  progress: Coll<M.UserProgressDoc>
  programs: Coll<M.TrainingProgramDoc>
  lessons: Coll<M.TrainingLessonDoc>
  lessonCompletions: Coll<M.LessonCompletionDoc>
  challenges: Coll<M.ChallengeDoc>
  preferences: Coll<M.UserPreferencesDoc>
  usage: Coll<M.UsageRecordDoc>
  audit: Coll<M.AuditLogDoc>
  rateLimits: Coll<M.RateLimitDoc>
  flags: Coll<M.FeatureFlagDoc>
  errors: Coll<M.ErrorLogDoc>
  contact: Coll<M.ContactMessageDoc>
}

const NAMES: Record<keyof Db, string> = {
  users: 'users',
  oauthAccounts: 'oauth_accounts',
  sessions: 'sessions',
  authTokens: 'auth_tokens',
  scenarios: 'scenarios',
  scenarioVersions: 'scenario_versions',
  games: 'games',
  evaluations: 'evaluations',
  chessGames: 'chess_games',
  progress: 'user_progress',
  programs: 'training_programs',
  lessons: 'training_lessons',
  lessonCompletions: 'lesson_completions',
  challenges: 'challenges',
  preferences: 'user_preferences',
  usage: 'usage_records',
  audit: 'audit_logs',
  rateLimits: 'rate_limits',
  flags: 'feature_flags',
  errors: 'error_logs',
  contact: 'contact_messages',
}

const g = globalThis as unknown as { __dealcraftDb?: Promise<Db> }

function dbNameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const name = u.pathname.replace(/^\//, '')
    return name || 'dealcraft'
  } catch {
    return 'dealcraft'
  }
}

async function build(): Promise<Db> {
  const url = env().DATABASE_URL
  const out = {} as Record<keyof Db, Coll<BaseDoc>>
  if (url.startsWith('memory://')) {
    for (const [key, name] of Object.entries(NAMES) as [keyof Db, string][]) {
      registerMemoryIndexes(name, INDEXES[name] ?? [])
      out[key] = new MemoryCollection(name)
    }
    const db = out as unknown as Db
    // A memory database starts empty; seed content so the demo is playable.
    const { seedContent } = await import('../content/seed')
    await seedContent(db)
    return db
  }
  const client = await mongoClient(url)
  const mdb = client.db(dbNameFromUrl(url))
  for (const [key, name] of Object.entries(NAMES) as [keyof Db, string][]) {
    out[key] = new MongoCollection(mdb.collection<BaseDoc>(name))
  }
  await ensureIndexes(mdb)
  return out as unknown as Db
}

async function ensureIndexes(mdb: import('mongodb').Db) {
  await Promise.all(
    Object.entries(INDEXES).flatMap(([name, specs]) =>
      specs.map((s) =>
        mdb
          .collection(name)
          .createIndex(s.keys, {
            unique: s.unique,
            expireAfterSeconds: s.expireAfterSeconds,
            partialFilterExpression: s.partial as Document | undefined,
          })
          .catch((err: unknown) => console.error(`[db] index on ${name} failed`, err instanceof Error ? err.message : err)),
      ),
    ),
  )
}

export function getDb(): Promise<Db> {
  g.__dealcraftDb ??= build().catch((err) => {
    g.__dealcraftDb = undefined
    throw err
  })
  return g.__dealcraftDb
}

/** Tests only: forget the cached registry. */
export function resetDbForTests() {
  g.__dealcraftDb = undefined
}

export const COLLECTION_INDEXES = INDEXES
export const COLLECTION_NAMES = NAMES
