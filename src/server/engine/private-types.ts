import type { Dimension, DialogueKind, StatementKind, Terms } from '@/lib/negotiation/types'

/**
 * Hidden scenario configuration. Stored in `scenario_versions.private`, loaded
 * only inside server-side services, never serialised to the client before a
 * game ends (and even then only the reveal subset in Evaluation.revealed).
 */

export type HiddenFact = {
  key: string
  /** What the counterpart says when the fact comes out. */
  text: string
  /** Short label shown in results ("Seller is relocating in 9 days"). */
  label: string
  trustRequired: number
  critical: boolean
  /** Extra flexibility the counterpart shows once the player knows this (0..0.3). */
  flex?: number
  /** Issue the fact relates to, for coaching text. */
  issue?: string
}

export type QuestionNode = {
  key: string
  prompt: string
  kind: DialogueKind
  answer: string
  /** Shown instead of the answer when trust is below `trustRequired` of the fact. */
  deflection?: string
  reveals?: string
  /** Only offered once this fact is known (branching dialogue). */
  requires?: string
  trust?: number
  keywords: string[]
}

export type StatementNode = {
  key: string
  text: string
  kind: StatementKind
  reply: string
  trust: number
  flex: number
  requires?: string
  keywords: string[]
}

export type CounterpartPrivate = {
  target: Terms
  limit: Terms
  weights: Record<string, number>
  opening: Terms
  /** 0.6 (conceder) .. 3 (Boulware / hard-liner) */
  firmness: number
  /** Minimum utility (0..1) the counterpart holds out for before flexibility bonuses. */
  floor: number
  trustStart: number
  /** Counterpart leaves if trust drops below this. */
  walkTrust: number
  /** Player turns before the counterpart issues a final offer and then leaves. */
  patience: number
  facts: HiddenFact[]
  agenda: string
  privateNotes: string
  lines: {
    accept: string
    finalOffer: string
    walk: string
    rejectExtreme: string
  }
}

export type ScoringRubric = {
  weights: Record<Dimension, number>
  /** Fact keys the player should discover for full information marks. */
  requiredDiscoveries: string[]
  /** True when no agreement beats any agreement on offer (walk-away scenario). */
  walkAwayIsBest: boolean
  coaching: string
}

export type ScenarioPrivate = {
  counterpart: CounterpartPrivate
  questions: QuestionNode[]
  statements: StatementNode[]
  rubric: ScoringRubric
}
