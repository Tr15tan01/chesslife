import type {
  Category,
  Difficulty,
  EngineState,
  Evaluation,
  GameMode,
  GameStatus,
  GameVariant,
  OutcomeKind,
  Prep,
  ScenarioPublic,
  Terms,
  Turn,
} from '@/lib/negotiation/types'
import type { BoardEdit, BotLevel, ChessMode, ChessMoveView, ChessStatus, Color, CommentView, DealKind, DealOutcome, EndReason, MomentKind } from '@/lib/chess/types'
import type { DealSpec } from '../chess/deals'
import type { ScenarioPrivate } from '../engine/private-types'

export type Role = 'USER' | 'ADMIN' | 'CONTENT_MANAGER'
export type UserStatus = 'ACTIVE' | 'SUSPENDED'
export type Plan = 'FREE' | 'PREMIUM'

export type UserDoc = {
  _id: string
  email: string
  name: string
  passwordHash: string | null
  emailVerified: Date | null
  role: Role
  status: UserStatus
  plan: Plan
  image: string | null
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date | null
  /** Bumped on password / role change; sessions carry the version they were issued with. */
  authVersion: number
}

export type OAuthAccountDoc = {
  _id: string
  userId: string
  provider: 'google'
  providerAccountId: string
  email: string | null
  createdAt: Date
}

export type SessionDoc = {
  _id: string
  tokenHash: string
  userId: string
  authVersion: number
  createdAt: Date
  lastSeenAt: Date
  expiresAt: Date
  userAgent: string | null
}

export type AuthTokenType = 'PASSWORD_RESET' | 'EMAIL_VERIFY'
export type AuthTokenDoc = {
  _id: string
  type: AuthTokenType
  tokenHash: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}

export type ScenarioDoc = {
  _id: string
  slug: string
  title: string
  summary: string
  category: Category
  difficulty: Difficulty
  tags: string[]
  quick: boolean
  estMinutes: number
  learningObjective: string
  counterpartName: string
  counterpartRole: string
  counterpartStyle: string
  issueLabels: string[]
  published: boolean
  visibility: 'PUBLIC' | 'PRIVATE'
  ownerId: string | null
  currentVersion: number
  /** Dimension weights duplicated here so recommendations need no private reads. */
  focus: string[]
  /** Content hash of the seeded definition (seeded scenarios only). */
  seedHash?: string
  createdAt: Date
  updatedAt: Date
}

export type ScenarioVersionDoc = {
  _id: string
  scenarioId: string
  version: number
  public: ScenarioPublic
  private: ScenarioPrivate
  createdAt: Date
  createdBy: string | null
}

export type GameDoc = {
  _id: string
  userId: string
  scenarioId: string
  scenarioSlug: string
  scenarioVersion: number
  scenarioTitle: string
  category: Category
  difficulty: Difficulty
  mode: GameMode
  variant: GameVariant
  status: GameStatus
  prep: Prep | null
  state: EngineState
  turns: Turn[]
  /** Recent idempotency keys; a replayed key returns the stored result. */
  processedKeys: string[]
  version: number
  timeLimitSec: number | null
  startedAt: Date | null
  deadlineAt: Date | null
  notes: string
  outcome: { kind: OutcomeKind; terms: Terms | null } | null
  score: number | null
  challengeSlug: string | null
  lessonSlug: string | null
  replayOf: { gameId: string; fromTurn: number } | null
  aiUsage: { calls: number; inputTokens: number; outputTokens: number }
  /** Engine state before each player move, for Replay & Improve. */
  snapshots: { turnIdx: number; label: string; state: EngineState }[]
  /** Remaining time while a timed game is paused. */
  pausedRemainingSec: number | null
  /** Set once progress has been applied, so completion is exactly-once. */
  progressApplied: boolean
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
}

export type EvaluationDoc = {
  _id: string // = gameId
  userId: string
  gameId: string
  scenarioSlug: string
  category: Category
  difficulty: Difficulty
  mode: GameMode
  variant: GameVariant
  evaluation: Evaluation
  createdAt: Date
}

export type UserProgressDoc = {
  _id: string // = userId
  gamesCompleted: number
  agreements: number
  walkAways: number
  bestScore: number
  streak: { current: number; best: number; lastDay: string | null }
  activeDays: string[]
  challengesPassed: string[]
  updatedAt: Date
}

export type TrainingProgramDoc = {
  _id: string
  slug: string
  title: string
  summary: string
  order: number
  skill: string
  published: boolean
  updatedAt: Date
}

export type LessonCard = { heading: string; body: string }
export type LessonQuiz = { question: string; options: string[]; answer: number; explain: string }

export type TrainingLessonDoc = {
  _id: string
  programId: string
  slug: string
  title: string
  order: number
  minutes: number
  cards: LessonCard[]
  example: { setup: string; weak: string; strong: string; why: string }
  quiz: LessonQuiz
  practiceScenario: string | null
  published: boolean
  updatedAt: Date
}

export type LessonCompletionDoc = {
  _id: string
  userId: string
  lessonId: string
  programId: string
  completedAt: Date
}

export type ChallengeCriteria = {
  maxTurns?: number
  minOutcome?: number
  mustDiscover?: string[]
  requireAgreement?: boolean
  requireWalkAway?: boolean
  minRelationship?: number
  limitIssue?: { key: string; max?: number; min?: number }
}

export type ChallengeDoc = {
  _id: string
  slug: string
  title: string
  summary: string
  scenarioSlug: string
  order: number
  criteria: ChallengeCriteria
  criteriaText: string[]
  published: boolean
}

export type UserPreferencesDoc = {
  _id: string // = userId
  theme: 'dark' | 'light'
  focusSkills: string[]
  defaultMode: 'CLASSIC' | 'AI'
  timedByDefault: boolean
  showRapport: boolean
  updatedAt: Date
}

export type UsageKind = 'AI_TURN' | 'AI_EVAL' | 'AI_SCENARIO'
export type UsageRecordDoc = {
  _id: string
  userId: string
  kind: UsageKind
  day: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  /** Estimated cost in micro-dollars; computed server-side from token counts the provider reported. */
  costMicros: number
  ok: boolean
  createdAt: Date
}

export type AuditLogDoc = {
  _id: string
  actorId: string | null
  actorEmail: string | null
  action: string
  targetType: string
  targetId: string | null
  meta: Record<string, unknown>
  createdAt: Date
}

export type RateLimitDoc = { _id: string; count: number; expiresAt: Date }

export type FeatureFlagDoc = { _id: string; enabled: boolean; value?: number; updatedAt: Date; updatedBy: string | null }

export type ErrorLogDoc = { _id: string; scope: string; message: string; createdAt: Date; userId: string | null }

export type ContactMessageDoc = { _id: string; name: string; email: string; topic: string; message: string; createdAt: Date; userId: string | null }

export type ChessGameDoc = {
  _id: string
  userId: string
  opponentKey: string
  level: BotLevel
  mode: ChessMode
  playerColor: Color
  status: ChessStatus
  endReason: EndReason | null
  fen: string
  moves: ChessMoveView[]
  comments: CommentView[]
  /** Scene text is resolved from the library by key; `body` holds the shown (possibly AI-worded) text. */
  scenes: { id: string; ply: number; kind: MomentKind; sceneKey: string; playerMoveNumber: number; body: string; source: CommentView['source']; chosenKey: string | null }[]
  /** Pieces removed by negotiated deals, anchored in the move timeline. */
  edits: BoardEdit[]
  /** The negotiation currently on the table; moves wait until it is settled. */
  deal: { id: string; kind: Exclude<DealKind, 'DRAW'>; by: 'player' | 'opponent'; ply: number; spec: DealSpec; state: EngineState; turns: Turn[] } | null
  deals: { id: string; kind: DealKind; by: 'player' | 'opponent'; ply: number; outcome: DealOutcome; terms: Terms | null; termsText: string | null; lesson: string; turns: Turn[] }[]
  processedKeys: string[]
  version: number
  aiUsage: { calls: number; inputTokens: number; outputTokens: number }
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
}
