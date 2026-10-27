import type { DialogueKind, Evaluation, GameMode, GameStatus, GameVariant, OfferRecord, OutcomeKind, Phase, Prep, ScenarioPublic, StatementKind, Terms, Turn } from './types'

/** Everything the player is allowed to see about a game. Built server-side. */
export type GameView = {
  id: string
  status: GameStatus
  mode: GameMode
  variant: GameVariant
  version: number
  scenario: ScenarioPublic
  turns: Turn[]
  phase: Phase
  turn: number
  maxTurns: number
  rapport: { label: string; level: 0 | 1 | 2 | 3 } | null
  playerOffer: Terms | null
  counterOffer: Terms | null
  finalOfferIssued: boolean
  offerHistory: OfferRecord[]
  discovered: { key: string; text: string }[]
  questions: { key: string; prompt: string; kind: DialogueKind; asked: boolean }[]
  statements: { key: string; text: string; kind: StatementKind; used: boolean }[]
  timeLimitSec: number | null
  deadlineAt: string | null
  pausedRemainingSec: number | null
  serverNow: string
  prep: Prep | null
  notes: string
  aiAvailable: boolean
  challenge: { slug: string; title: string; criteriaText: string[] } | null
  lesson: { slug: string; title: string } | null
  replayOf: { gameId: string; fromTurn: number } | null
  snapshots: { turnIdx: number; label: string }[]
  outcome: { kind: OutcomeKind; terms: Terms | null } | null
  createdAt: string
  completedAt: string | null
}

export type ResultView = {
  game: GameView
  evaluation: Evaluation
}

export type HistoryItem = {
  id: string
  scenarioSlug: string
  scenarioTitle: string
  category: string
  difficulty: number
  mode: GameMode
  variant: GameVariant
  status: GameStatus
  score: number | null
  createdAt: string
  completedAt: string | null
}
