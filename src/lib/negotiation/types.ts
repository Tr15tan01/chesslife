/**
 * Negotiation domain types. This module is isomorphic: it contains only the
 * shapes that are safe for the browser. Hidden counterpart configuration
 * lives in `src/server/engine/private-types.ts` and never reaches the client.
 */

export const CATEGORIES = ['career', 'business', 'buying-selling', 'personal', 'leadership', 'advanced'] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  career: 'Career',
  business: 'Business',
  'buying-selling': 'Buying & selling',
  personal: 'Personal',
  leadership: 'Leadership & teams',
  advanced: 'Advanced',
}

export type Difficulty = 1 | 2 | 3 | 4
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: 'Foundational',
  2: 'Intermediate',
  3: 'Advanced',
  4: 'Expert',
}

export type CounterpartStyle = 'cooperative' | 'assertive' | 'skeptical' | 'impatient' | 'cautious' | 'strategic'

export const STYLE_LABELS: Record<CounterpartStyle, string> = {
  cooperative: 'Cooperative',
  assertive: 'Assertive',
  skeptical: 'Skeptical',
  impatient: 'Impatient',
  cautious: 'Cautious',
  strategic: 'Highly strategic',
}

export type IssueUnit = 'currency' | 'percent' | 'days' | 'weeks' | 'months' | 'hours' | 'count' | 'clock' | 'choice'

export type Issue = {
  key: string
  label: string
  unit: IssueUnit
  min: number
  max: number
  step: number
  /** Which direction is better for the player. */
  playerPrefers: 'higher' | 'lower'
  /** For `choice` issues: value is the option index. */
  choices?: string[]
  hint?: string
}

export type Terms = Record<string, number>

export type GameMode = 'CLASSIC' | 'AI'
export type GameVariant = 'STANDARD' | 'QUICK' | 'CHALLENGE' | 'ACADEMY' | 'REPLAY' | 'CUSTOM'

export const GAME_STATUSES = ['CREATED', 'ACTIVE', 'PAUSED', 'AGREEMENT_REACHED', 'WALKED_AWAY', 'FAILED', 'EXPIRED'] as const
export type GameStatus = (typeof GAME_STATUSES)[number]
export const TERMINAL_STATUSES: readonly GameStatus[] = ['AGREEMENT_REACHED', 'WALKED_AWAY', 'FAILED', 'EXPIRED']

export type Phase = 'OPENING' | 'EXPLORATION' | 'BARGAINING' | 'CLOSING' | 'CLOSED'

export type DialogueKind = 'interest' | 'constraint' | 'alternatives' | 'rapport' | 'leading'
export type StatementKind = 'rationale' | 'empathy' | 'pressure' | 'bluff' | 'commitment' | 'summary'

/** Public option the player can pick in Classic mode. */
export type QuestionOption = { key: string; prompt: string; kind: DialogueKind; locked?: boolean }
export type StatementOption = { key: string; text: string; kind: StatementKind; locked?: boolean }

export type PlayerBrief = {
  /** The player's hard limits (their own walk-away point per issue). */
  limits: Terms
  /** Suggested ambitious targets; the player sets their own during preparation. */
  suggestedTargets: Terms
  /** 1..3 importance per issue for the player. */
  priorities: Record<string, 1 | 2 | 3>
  batna: string
  context: string[]
}

export type CounterpartPublic = {
  name: string
  role: string
  style: CounterpartStyle
  bio: string
  /** Muted accent used for the avatar disc. */
  tone: 'gold' | 'slate' | 'sage' | 'rose' | 'ink'
}

export type ScenarioPublic = {
  slug: string
  title: string
  summary: string
  description: string
  category: Category
  difficulty: Difficulty
  playerRole: string
  counterpart: CounterpartPublic
  issues: Issue[]
  brief: PlayerBrief
  publicObjectives: string[]
  learningObjective: string
  successLooksLike: string
  outcomeRange: string
  estMinutes: number
  quick: boolean
  defaultTimeLimitSec: number
  maxTurns: number
  tags: string[]
  opening: string
}

export type ActionType =
  | 'START'
  | 'ASK'
  | 'STATEMENT'
  | 'MESSAGE'
  | 'MAKE_OFFER'
  | 'REQUEST_CONCESSION'
  | 'ACCEPT'
  | 'REJECT'
  | 'PAUSE'
  | 'RESUME'
  | 'WALK_AWAY'
  | 'COUNTER'
  | 'REPLY'
  | 'COUNTERPART_ACCEPT'
  | 'COUNTERPART_WALK'
  | 'EXPIRE'
  | 'SYSTEM'

export type Turn = {
  idx: number
  at: string
  actor: 'player' | 'counterpart' | 'system'
  action: ActionType
  text: string
  offer?: Terms
  ref?: string
  /** Facts revealed in this turn (public text only). */
  revealed?: { key: string; text: string }[]
  note?: string
  source?: 'rules' | 'ai' | 'mock-ai'
}

export type OfferRecord = { turn: number; terms: Terms; by: 'player' | 'counterpart' }

export type EngineState = {
  turn: number
  /** Bargaining clock: offers count fully, conversation partially. Drives concession timing. */
  clock: number
  phase: Phase
  trust: number
  flex: number
  discovered: string[]
  asked: string[]
  used: string[]
  offers: OfferRecord[]
  playerOffer: Terms | null
  counterOffer: Terms | null
  finalOfferIssued: boolean
  counts: {
    questions: number
    rationale: number
    empathy: number
    pressure: number
    bluff: number
    rejects: number
    concessionRequests: number
    tradeoffs: number
    messages: number
  }
  agreement: Terms | null
}

export type OutcomeKind = 'AGREEMENT' | 'PLAYER_WALKED' | 'COUNTERPART_WALKED' | 'NO_DEAL' | 'EXPIRED'

export type Prep = { targets: Terms; walkAway: Terms; plan?: string }

export const DIMENSIONS = [
  'outcome',
  'preparation',
  'information',
  'offers',
  'communication',
  'value',
  'composure',
  'relationship',
] as const
export type Dimension = (typeof DIMENSIONS)[number]

export const DIMENSION_LABELS: Record<Dimension, string> = {
  outcome: 'Outcome quality',
  preparation: 'Preparation',
  information: 'Information gathering',
  offers: 'Offer strategy',
  communication: 'Communication',
  value: 'Value creation',
  composure: 'Emotional control',
  relationship: 'Ethics & relationship',
}

export const DIMENSION_SHORT: Record<Dimension, string> = {
  outcome: 'Outcome',
  preparation: 'Prep',
  information: 'Discovery',
  offers: 'Offers',
  communication: 'Communication',
  value: 'Value',
  composure: 'Composure',
  relationship: 'Relationship',
}

export type DimensionScore = {
  score: number
  weight: number
  rationale: string
  source: 'rules' | 'ai' | 'blended'
}

export type KeyMoment = { turn: number; title: string; detail: string; tone: 'good' | 'missed' | 'neutral' }
export type Alternative = { turn: number; instead: string; try: string; consequence: string }

export type Evaluation = {
  overall: number
  dimensions: Record<Dimension, DimensionScore>
  strengths: string[]
  missed: string[]
  moments: KeyMoment[]
  alternatives: Alternative[]
  suggestions: string[]
  takeaway: string
  recommended: { slug: string; title: string; reason: string } | null
  facts: {
    outcome: OutcomeKind
    agreement: Terms | null
    playerUtility: number | null
    turns: number
    offersMade: number
    concessions: number
    discovered: number
    discoverable: number
    zopaExisted: boolean
    walkAwayWasBest: boolean
    respectedOwnLimit: boolean | null
  }
  revealed: {
    counterpartLimits: Terms
    counterpartTargets: Terms
    hiddenFacts: { key: string; text: string; discovered: boolean }[]
    notes: string
  }
  aiAssessed: boolean
  challenge?: { slug: string; title: string; passed: boolean; criteria: { label: string; met: boolean }[] }
}

export function isTerminal(status: GameStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}
