import type {
  Category,
  CounterpartPublic,
  CounterpartStyle,
  Difficulty,
  Dimension,
  DialogueKind,
  Issue,
  IssueUnit,
  ScenarioPublic,
  StatementKind,
  Terms,
} from '@/lib/negotiation/types'
import type { HiddenFact, QuestionNode, ScenarioPrivate, StatementNode } from '../engine/private-types'

/** Compact authoring format for seeded scenarios. */

export type IssueIn = { key: string; label: string; unit: IssueUnit; min: number; max: number; step: number; prefers: 'higher' | 'lower'; hint?: string; choices?: string[] }

export type ScenarioIn = {
  slug: string
  title: string
  summary: string
  description: string
  category: Category
  difficulty: Difficulty
  role: string
  cp: { name: string; role: string; style: CounterpartStyle; bio: string; tone: CounterpartPublic['tone'] }
  issues: IssueIn[]
  player: { limits: Terms; targets: Terms; priorities?: Record<string, 1 | 2 | 3>; batna: string; context: string[] }
  objectives: string[]
  learning: string
  success: string
  range: string
  minutes: number
  quick?: boolean
  timeLimit?: number
  maxTurns?: number
  tags: string[]
  opening: string
  hidden: {
    target: Terms
    limit: Terms
    weights?: Record<string, number>
    opening: Terms
    firmness: number
    floor: number
    trust: number
    walkTrust?: number
    patience: number
    agenda: string
    notes: string
  }
  facts: { key: string; label: string; text?: string; trust?: number; critical?: boolean; flex?: number; issue?: string }[]
  questions: { key: string; prompt: string; kind: DialogueKind; answer: string; deflection?: string; reveals?: string; requires?: string; trust?: number; kw: string[] }[]
  statements: { key: string; text: string; kind: StatementKind; reply: string; trust?: number; flex?: number; requires?: string; kw: string[] }[]
  rubric: { weights?: Partial<Record<Dimension, number>>; required?: string[]; walkBest?: boolean; coaching: string }
  lines?: Partial<ScenarioPrivate['counterpart']['lines']>
}

const CATEGORY_WEIGHTS: Record<Category, Record<Dimension, number>> = {
  career: { outcome: 3, preparation: 2, information: 2, offers: 3, communication: 2, value: 1, composure: 1, relationship: 2 },
  business: { outcome: 3, preparation: 2, information: 2, offers: 2, communication: 1, value: 3, composure: 1, relationship: 2 },
  'buying-selling': { outcome: 3, preparation: 2, information: 2, offers: 3, communication: 1, value: 1, composure: 2, relationship: 1 },
  personal: { outcome: 1, preparation: 1, information: 3, offers: 1, communication: 3, value: 3, composure: 2, relationship: 3 },
  leadership: { outcome: 2, preparation: 1, information: 3, offers: 1, communication: 3, value: 3, composure: 2, relationship: 3 },
  advanced: { outcome: 3, preparation: 2, information: 3, offers: 2, communication: 1, value: 2, composure: 2, relationship: 1 },
}

const STYLE_LINES: Record<CounterpartStyle, ScenarioPrivate['counterpart']['lines']> = {
  cooperative: {
    accept: "That works for me. Let's shake on it.",
    finalOffer: "I've stretched as far as I can. My final offer is",
    walk: "I don't think we're going to get there today. Let's leave it here.",
    rejectExtreme: "That's too far from where I can be.",
  },
  assertive: {
    accept: 'Deal. Good doing business.',
    finalOffer: 'Last offer, and I mean it:',
    walk: "We're done here. I'll take my business elsewhere.",
    rejectExtreme: "That's not serious.",
  },
  skeptical: {
    accept: "Alright. That I can justify. We have a deal.",
    finalOffer: "I've made my case. My final position is",
    walk: "I'm not convinced this is going anywhere. I'll pass.",
    rejectExtreme: 'That has no basis.',
  },
  impatient: {
    accept: 'Done. Finally.',
    finalOffer: "I'm out of time. Final offer:",
    walk: "I can't keep doing this. I'm out.",
    rejectExtreme: 'No.',
  },
  cautious: {
    accept: "Yes, I'm comfortable with that. Agreed.",
    finalOffer: "I've thought hard about it. The most I can do is",
    walk: "I'm sorry, I don't feel comfortable continuing.",
    rejectExtreme: "I couldn't agree to that.",
  },
  strategic: {
    accept: 'That reflects the value on both sides. Agreed.',
    finalOffer: "Let's be clear about where this ends. My final proposal:",
    walk: 'We clearly value this differently. I have better alternatives.',
    rejectExtreme: "Let's not waste time with anchors like that.",
  },
}

function defaultWeights(issues: IssueIn[]): Record<string, number> {
  return Object.fromEntries(issues.map((i) => [i.key, 1 / issues.length]))
}

export type BuiltScenario = { pub: ScenarioPublic; priv: ScenarioPrivate; focus: Dimension[] }

export function defineScenario(s: ScenarioIn): BuiltScenario {
  const issues: Issue[] = s.issues.map((i) => ({
    key: i.key,
    label: i.label,
    unit: i.unit,
    min: i.min,
    max: i.max,
    step: i.step,
    playerPrefers: i.prefers,
    hint: i.hint,
    choices: i.choices,
  }))
  const weights = s.hidden.weights ?? defaultWeights(s.issues)
  const wsum = Object.values(weights).reduce((a, b) => a + b, 0)
  const normWeights = Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, v / wsum]))
  const rubricWeights = { ...CATEGORY_WEIGHTS[s.category], ...(s.rubric.weights ?? {}) }
  const facts: HiddenFact[] = s.facts.map((f) => ({
    key: f.key,
    label: f.label,
    text: f.text ?? f.label,
    trustRequired: f.trust ?? 0,
    critical: f.critical ?? true,
    flex: f.flex,
    issue: f.issue,
  }))
  const questions: QuestionNode[] = s.questions.map((q) => ({
    key: q.key,
    prompt: q.prompt,
    kind: q.kind,
    answer: q.answer,
    deflection: q.deflection,
    reveals: q.reveals,
    requires: q.requires,
    trust: q.trust,
    keywords: q.kw,
  }))
  const statements: StatementNode[] = s.statements.map((st) => ({
    key: st.key,
    text: st.text,
    kind: st.kind,
    reply: st.reply,
    trust: st.trust ?? (st.kind === 'empathy' ? 5 : st.kind === 'rationale' ? 3 : st.kind === 'bluff' ? -6 : st.kind === 'pressure' ? -8 : 2),
    flex: st.flex ?? (st.kind === 'rationale' ? 0.04 : st.kind === 'empathy' ? 0.02 : st.kind === 'bluff' ? 0.03 : 0),
    requires: st.requires,
    keywords: st.kw,
  }))
  const priorities = s.player.priorities ?? Object.fromEntries(s.issues.map((i) => [i.key, 2 as const]))
  const patience = s.hidden.patience
  const pub: ScenarioPublic = {
    slug: s.slug,
    title: s.title,
    summary: s.summary,
    description: s.description,
    category: s.category,
    difficulty: s.difficulty,
    playerRole: s.role,
    counterpart: s.cp,
    issues,
    brief: { limits: s.player.limits, suggestedTargets: s.player.targets, priorities, batna: s.player.batna, context: s.player.context },
    publicObjectives: s.objectives,
    learningObjective: s.learning,
    successLooksLike: s.success,
    outcomeRange: s.range,
    estMinutes: s.minutes,
    quick: s.quick ?? false,
    defaultTimeLimitSec: s.timeLimit ?? (s.quick ? 180 : 600),
    maxTurns: s.maxTurns ?? Math.round(patience * 1.6) + 4,
    tags: s.tags,
    opening: s.opening,
  }
  const priv: ScenarioPrivate = {
    counterpart: {
      target: s.hidden.target,
      limit: s.hidden.limit,
      weights: normWeights,
      opening: s.hidden.opening,
      firmness: s.hidden.firmness,
      floor: s.hidden.floor,
      trustStart: s.hidden.trust,
      walkTrust: s.hidden.walkTrust ?? 12,
      patience,
      facts,
      agenda: s.hidden.agenda,
      privateNotes: s.hidden.notes,
      lines: { ...STYLE_LINES[s.cp.style], ...(s.lines ?? {}) },
    },
    questions,
    statements,
    rubric: {
      weights: rubricWeights,
      requiredDiscoveries: s.rubric.required ?? facts.filter((f) => f.critical).map((f) => f.key),
      walkAwayIsBest: s.rubric.walkBest ?? false,
      coaching: s.rubric.coaching,
    },
  }
  const focus = (Object.entries(rubricWeights) as [Dimension, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => d)
  return { pub, priv, focus }
}
