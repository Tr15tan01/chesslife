import {
  DIMENSIONS,
  DIMENSION_LABELS,
  type Alternative,
  type Dimension,
  type DimensionScore,
  type EngineState,
  type Evaluation,
  type KeyMoment,
  type OutcomeKind,
  type Prep,
  type Terms,
  type Turn,
} from '@/lib/negotiation/types'
import { formatTerms, formatValue } from '@/lib/negotiation/format'
import type { ChallengeCriteria } from '../db/models'
import {
  type ScenarioContext,
  bestJointValue,
  cpUtility,
  playerBetter,
  playerUtility,
  withinPlayerLimits,
  zopaExists,
} from './utility'

/**
 * Deterministic, rule-based evaluation. Every number here is derived from
 * recorded turns and authoritative scenario data — never from the client.
 * The AI evaluator (when enabled) can only adjust qualitative dimensions
 * within a bounded band; see services/evaluation.ts.
 */

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)))

export type EvalInput = {
  ctx: ScenarioContext
  state: EngineState
  turns: Turn[]
  prep: Prep | null
  outcome: { kind: OutcomeKind; terms: Terms | null }
}

type Partial = { score: number; rationale: string }

function playerConcessions(ctx: ScenarioContext, state: EngineState): { count: number; sizes: number[] } {
  const own = state.offers.filter((o) => o.by === 'player')
  const sizes: number[] = []
  for (let k = 1; k < own.length; k++) {
    const d = playerUtility(ctx, own[k - 1]!.terms) - playerUtility(ctx, own[k]!.terms)
    if (d > 0.005) sizes.push(d)
  }
  return { count: sizes.length, sizes }
}

function scoreOutcome(i: EvalInput, u: number | null): Partial {
  const { ctx, outcome, state } = i
  const zopa = zopaExists(ctx)
  const walkBest = ctx.priv.rubric.walkAwayIsBest || !zopa
  const lastCounter = state.counterOffer
  if (outcome.kind === 'AGREEMENT' && u !== null) {
    if (walkBest) return { score: clamp(20 + 10 * Math.max(0, u)), rationale: 'An agreement was reached, but no deal on offer beat your alternative. Walking away was the stronger result here.' }
    if (u < 0) return { score: clamp(30 + 30 * u), rationale: 'You agreed to terms worse than your own walk-away limit.' }
    return { score: clamp(40 + 60 * Math.min(1, u)), rationale: `You captured about ${Math.round(Math.min(1, u) * 100)}% of the value available between your limit and the most the other side could give.` }
  }
  if (outcome.kind === 'PLAYER_WALKED') {
    if (walkBest) return { score: 92, rationale: 'No agreement could beat your alternative. Walking away was the right call.' }
    if (lastCounter && withinPlayerLimits(ctx, lastCounter)) return { score: 22, rationale: 'You walked away while an offer within your limits was on the table.' }
    return { score: 50, rationale: 'You walked away from terms outside your limits. Disciplined, though a deal was possible with more exploration.' }
  }
  if (walkBest) return { score: 70, rationale: 'No deal was reached, which protected you, but ending deliberately would have been clearer.' }
  if (outcome.kind === 'COUNTERPART_WALKED') return { score: 15, rationale: 'The other side ended the negotiation before a deal was reached.' }
  if (outcome.kind === 'EXPIRED') return { score: 15, rationale: 'Time ran out before an agreement.' }
  return { score: 18, rationale: 'The conversation ended without an agreement although one was possible.' }
}

function scorePreparation(i: EvalInput): Partial {
  const { prep, ctx } = i
  if (!prep) return { score: 25, rationale: 'You skipped preparation: no targets or walk-away point were set.' }
  let score = 45
  const notes: string[] = []
  let ambitious = 0
  let sound = 0
  for (const issue of ctx.pub.issues) {
    const t = prep.targets[issue.key]
    const w = prep.walkAway[issue.key]
    const lim = ctx.pub.brief.limits[issue.key]!
    const range = issue.max - issue.min || 1
    if (t !== undefined && Math.abs(t - lim) >= range * 0.1 && playerBetter(issue, t, lim)) ambitious++
    if (w !== undefined && (w === lim || playerBetter(issue, w, lim))) sound++
  }
  const n = ctx.pub.issues.length
  score += Math.round((ambitious / n) * 20)
  score += Math.round((sound / n) * 20)
  if (ambitious === n) notes.push('targets were ambitious')
  else notes.push('some targets sat close to your limit')
  if (sound === n) notes.push('your walk-away respected your real limits')
  else notes.push('a walk-away point was looser than your actual limit')
  if (prep.plan && prep.plan.trim().length >= 20) {
    score += 15
    notes.push('you wrote a plan')
  }
  return { score: clamp(score), rationale: `Prepared: ${notes.join(', ')}.` }
}

function scoreInformation(i: EvalInput): Partial {
  const { ctx, state, turns } = i
  const req = ctx.priv.rubric.requiredDiscoveries
  const found = req.filter((k) => state.discovered.includes(k)).length
  const ratio = req.length ? found / req.length : state.discovered.length > 0 ? 1 : 0.5
  const firstOfferIdx = turns.findIndex((t) => t.actor === 'player' && t.action === 'MAKE_OFFER')
  const before = turns.slice(0, firstOfferIdx === -1 ? turns.length : firstOfferIdx).filter((t) => t.actor === 'player' && (t.action === 'ASK' || t.action === 'MESSAGE')).length
  const repeats = turns.filter((t) => t.text && /already|covered that|asked that/i.test(t.text) && t.actor === 'counterpart').length
  const score = 15 + 60 * ratio + Math.min(20, before * 8) - repeats * 4
  return {
    score: clamp(score),
    rationale: `You uncovered ${found} of ${req.length} key facts${before ? ` and asked ${before} question${before === 1 ? '' : 's'} before your first offer` : ' and made offers before asking questions'}.`,
  }
}

function scoreOffers(i: EvalInput, u: number | null): Partial {
  const { ctx, state, outcome } = i
  const own = state.offers.filter((o) => o.by === 'player')
  const notes: string[] = []
  let score = 50
  const conc = playerConcessions(ctx, state)
  if (own.length === 0) {
    if (outcome.kind === 'AGREEMENT') {
      const cpOffers = state.offers.filter((o) => o.by === 'counterpart').length
      if (cpOffers <= 1) {
        score = 25
        notes.push('you accepted their first offer without countering')
      } else {
        score = 45
        notes.push('you only reacted to their offers and never proposed your own')
      }
    } else {
      score = 30
      notes.push('you never put an offer on the table')
    }
  } else {
    const first = own[0]!.terms
    const firstU = playerUtility(ctx, first)
    if (cpUtility(ctx, first) < -0.6) {
      score -= 10
      notes.push('your opening anchor was extreme and cost credibility')
    } else if (firstU >= 0.8) {
      score += 15
      notes.push('your opening anchor was ambitious yet credible')
    } else if (firstU < 0.4) {
      score -= 8
      notes.push('your opening offer left little room to concede')
    }
    if (conc.sizes.length >= 2) {
      const shrinking = conc.sizes.every((s, k) => k === 0 || s <= conc.sizes[k - 1]! + 0.02)
      if (shrinking) {
        score += 12
        notes.push('your concessions got smaller over time')
      } else {
        score -= 6
        notes.push('your concession sizes were uneven, which signals more room')
      }
    }
    if (conc.sizes.some((s) => s > 0.45)) {
      score -= 10
      notes.push('one concession gave away a large share at once')
    }
    if (state.counts.tradeoffs > 0) {
      score += 8
      notes.push('you traded across issues')
    }
  }
  if (outcome.kind === 'AGREEMENT' && u !== null && u < 0) {
    score -= 20
    notes.push('the final terms broke your own limit')
  }
  return { score: clamp(score), rationale: notes.length ? `${notes[0]!.replace(/^./, (c) => c.toUpperCase())}${notes.length > 1 ? `; ${notes.slice(1).join('; ')}` : ''}.` : 'Your offers were reasonable.' }
}

function scoreCommunication(i: EvalInput): Partial {
  const c = i.state.counts
  const summary = i.state.used.includes('summary') ? 1 : 0
  const score = 45 + Math.min(3, c.rationale) * 10 + Math.min(2, c.empathy) * 8 + summary * 5 - c.pressure * 10 - c.bluff * 8 - Math.max(0, c.rejects - 1) * 4
  const bits: string[] = []
  if (c.rationale) bits.push(`gave reasons ${c.rationale}×`)
  if (c.empathy) bits.push(`acknowledged their position ${c.empathy}×`)
  if (summary) bits.push('summarised progress')
  if (c.pressure) bits.push(`used pressure ${c.pressure}×`)
  if (c.bluff) bits.push('made a claim that was not true')
  if (c.rejects > 1) bits.push(`rejected ${c.rejects} times without a counter`)
  return { score: clamp(score), rationale: bits.length ? `You ${bits.join(', ')}.` : 'You mostly exchanged numbers without explaining or acknowledging.' }
}

function scoreValue(i: EvalInput): Partial {
  const { ctx, state, outcome } = i
  const interestQs = ctx.priv.questions.filter((q) => q.kind === 'interest' && state.asked.includes(q.key)).length + (state.asked.includes('priorities') ? 1 : 0)
  if (ctx.pub.issues.length > 1 && outcome.kind === 'AGREEMENT' && outcome.terms) {
    const best = bestJointValue(ctx)
    const got = playerUtility(ctx, outcome.terms) + cpUtility(ctx, outcome.terms)
    const ratio = best > 0 ? Math.max(0, Math.min(1, got / best)) : 0.5
    return {
      score: clamp(25 + 55 * ratio + Math.min(2, state.counts.tradeoffs) * 6 + Math.min(2, interestQs) * 4),
      rationale: `The final package reached ${Math.round(ratio * 100)}% of the best joint value available${state.counts.tradeoffs ? ', helped by trade-offs across issues' : ''}.`,
    }
  }
  const facts = state.discovered.filter((k) => k !== 'priorities').length
  return {
    score: clamp(30 + interestQs * 12 + facts * 8 + state.counts.tradeoffs * 8),
    rationale: interestQs || facts ? `You explored interests (${interestQs} interest question${interestQs === 1 ? '' : 's'}, ${facts} fact${facts === 1 ? '' : 's'} uncovered).` : 'You treated this as a pure tug-of-war and did not explore what the other side needed.',
  }
}

function scoreComposure(i: EvalInput): Partial {
  const { state, outcome, ctx } = i
  let score = 82
  const notes: string[] = []
  if (state.counts.pressure) {
    score -= state.counts.pressure * 12
    notes.push('pressure tactics')
  }
  if (state.counts.rejects > 2) {
    score -= 10
    notes.push('repeated flat rejections')
  }
  if (outcome.kind === 'PLAYER_WALKED' && state.turn <= 2 && zopaExists(ctx) && !ctx.priv.rubric.walkAwayIsBest) {
    score -= 25
    notes.push('walking away very early')
  }
  const cpOffers = state.offers.filter((o) => o.by === 'counterpart').length
  if (outcome.kind === 'AGREEMENT' && cpOffers <= 1 && state.offers.filter((o) => o.by === 'player').length === 0) {
    score -= 15
    notes.push('accepting the first number')
  }
  if (state.finalOfferIssued && outcome.kind !== 'COUNTERPART_WALKED') {
    score += 6
    notes.push('handling a final-offer moment deliberately')
  }
  return { score: clamp(score), rationale: notes.length ? `Observed: ${notes.join(', ')}.` : 'You stayed steady and deliberate throughout.' }
}

function scoreRelationship(i: EvalInput): Partial {
  const { state } = i
  const score = state.trust - state.counts.bluff * 10 + (i.outcome.kind === 'COUNTERPART_WALKED' ? -15 : 0)
  return { score: clamp(score), rationale: `Rapport ended at ${state.trust}/100${state.counts.bluff ? ', and a misleading claim damaged credibility' : ''}.` }
}

function buildMoments(i: EvalInput): KeyMoment[] {
  const { turns, ctx } = i
  const out: KeyMoment[] = []
  const firstOffer = turns.find((t) => t.actor === 'player' && t.action === 'MAKE_OFFER')
  if (firstOffer) out.push({ turn: firstOffer.idx, title: 'Your first offer', detail: formatTerms(ctx.pub.issues, firstOffer.offer), tone: 'neutral' })
  for (const t of turns) {
    if (t.revealed?.length) out.push({ turn: t.idx, title: 'Discovery', detail: t.revealed.map((r) => r.text).join(' '), tone: 'good' })
    if (t.actor === 'player' && (t.ref === 'pressure' || /take it or leave it/i.test(t.text))) out.push({ turn: t.idx, title: 'Pressure applied', detail: 'Rapport dropped noticeably after this.', tone: 'missed' })
    if (t.note?.startsWith('They deflected')) out.push({ turn: t.idx, title: 'Deflected question', detail: 'They were not ready to share this yet.', tone: 'missed' })
    if (t.note?.startsWith('Final offer')) out.push({ turn: t.idx, title: 'Final offer', detail: formatTerms(ctx.pub.issues, t.offer), tone: 'neutral' })
  }
  const last = turns[turns.length - 1]
  if (last) out.push({ turn: last.idx, title: 'Ending', detail: last.text, tone: i.outcome.kind === 'AGREEMENT' ? 'good' : 'neutral' })
  return out.slice(0, 8)
}

function buildAlternatives(i: EvalInput): Alternative[] {
  const { ctx, state, turns } = i
  const alts: Alternative[] = []
  const firstOffer = turns.find((t) => t.actor === 'player' && t.action === 'MAKE_OFFER')
  for (const f of ctx.priv.counterpart.facts) {
    if (state.discovered.includes(f.key)) continue
    const q = ctx.priv.questions.find((x) => x.reveals === f.key)
    if (!q) continue
    alts.push({
      turn: firstOffer?.idx ?? 1,
      instead: firstOffer ? 'Making an offer at this point' : 'Moving on without probing',
      try: q.prompt,
      consequence: `This would have surfaced: ${f.label}${f.flex ? ' — and they would have had more room to move.' : '.'}${f.trustRequired > 50 ? ' They only share this once rapport is high.' : ''}`,
    })
  }
  const pressure = turns.find((t) => t.actor === 'player' && t.ref === 'pressure')
  if (pressure) {
    const emp = ctx.priv.statements.find((s) => s.kind === 'empathy')
    alts.push({
      turn: pressure.idx,
      instead: pressure.text,
      try: emp?.text ?? 'Acknowledge their constraint, then restate your need.',
      consequence: 'Acknowledging their position keeps rapport intact and makes concessions easier for them to justify.',
    })
  }
  const accepted = turns.find((t) => t.actor === 'player' && t.action === 'ACCEPT')
  if (accepted && state.offers.filter((o) => o.by === 'player').length === 0) {
    alts.push({
      turn: accepted.idx,
      instead: 'Accepting their number',
      try: 'Counter with an ambitious but reasoned offer.',
      consequence: 'Most counterparts open with room built in. A single counteroffer usually recovers part of it.',
    })
  }
  return alts.slice(0, 4)
}

export function evaluateGame(i: EvalInput): Evaluation {
  const { ctx, state, outcome } = i
  const u = outcome.terms ? playerUtility(ctx, outcome.terms) : null
  const parts: Record<Dimension, Partial> = {
    outcome: scoreOutcome(i, u),
    preparation: scorePreparation(i),
    information: scoreInformation(i),
    offers: scoreOffers(i, u),
    communication: scoreCommunication(i),
    value: scoreValue(i),
    composure: scoreComposure(i),
    relationship: scoreRelationship(i),
  }
  const weights = ctx.priv.rubric.weights
  const dims = {} as Record<Dimension, DimensionScore>
  let wsum = 0
  let total = 0
  for (const d of DIMENSIONS) {
    const w = weights[d] ?? 1
    dims[d] = { score: parts[d].score, weight: w, rationale: parts[d].rationale, source: 'rules' }
    wsum += w
    total += w * parts[d].score
  }
  const overall = clamp(total / (wsum || 1))

  const sorted = [...DIMENSIONS].sort((a, b) => dims[b].score - dims[a].score)
  const strengths = sorted.filter((d) => dims[d].score >= 65).slice(0, 3).map((d) => `${DIMENSION_LABELS[d]}: ${dims[d].rationale}`)
  if (!strengths.length) strengths.push(`${DIMENSION_LABELS[sorted[0]!]} was your strongest area. ${dims[sorted[0]!].rationale}`)
  const weakest = [...sorted].reverse()

  const missed: string[] = []
  for (const f of ctx.priv.counterpart.facts) if (!state.discovered.includes(f.key) && f.critical) missed.push(`You never learned: ${f.label}.`)
  if (state.offers.filter((o) => o.by === 'player').length === 0 && outcome.kind === 'AGREEMENT') missed.push('You did not make a single counteroffer.')
  if (ctx.pub.issues.length > 1 && state.counts.tradeoffs === 0) missed.push('You did not trade one issue against another.')
  if (state.counts.empathy === 0) missed.push('You never acknowledged their perspective.')

  const SUGGEST: Record<Dimension, string> = {
    outcome: 'Before accepting, compare the offer with your target and your alternative, not with their last number.',
    preparation: 'Use the preparation step: set an ambitious target and a firm walk-away for every issue before you speak.',
    information: 'Ask at least two open questions before your first offer. Return to deflected questions once rapport improves.',
    offers: 'Open ambitiously with a reason, then make each concession smaller than the last and ask for something in return.',
    communication: 'Pair every number with a short reason, and acknowledge their constraint before restating yours.',
    value: 'Ask what matters most to them, then give ground on their priorities in exchange for yours.',
    composure: 'Replace ultimatums with questions. If you feel stuck, summarise and ask what would make it work.',
    relationship: 'Keep claims accurate. Credibility is a resource you spend every time you exaggerate.',
  }
  const suggestions = weakest.slice(0, 3).map((d) => SUGGEST[d])

  const walkBest = ctx.priv.rubric.walkAwayIsBest || !zopaExists(ctx)
  const ownConc = playerConcessions(ctx, state)
  const discoverable = ctx.priv.rubric.requiredDiscoveries.length

  return {
    overall,
    dimensions: dims,
    strengths,
    missed: missed.slice(0, 4),
    moments: buildMoments(i),
    alternatives: buildAlternatives(i),
    suggestions,
    takeaway: ctx.priv.rubric.coaching,
    recommended: null,
    facts: {
      outcome: outcome.kind,
      agreement: outcome.terms,
      playerUtility: u === null ? null : Number(u.toFixed(3)),
      turns: state.turn,
      offersMade: state.offers.filter((o) => o.by === 'player').length,
      concessions: ownConc.count,
      discovered: ctx.priv.rubric.requiredDiscoveries.filter((k) => state.discovered.includes(k)).length,
      discoverable,
      zopaExisted: zopaExists(ctx),
      walkAwayWasBest: walkBest,
      respectedOwnLimit: outcome.terms ? withinPlayerLimits(ctx, outcome.terms) : null,
    },
    revealed: {
      counterpartLimits: ctx.priv.counterpart.limit,
      counterpartTargets: ctx.priv.counterpart.target,
      hiddenFacts: ctx.priv.counterpart.facts.map((f) => ({ key: f.key, text: f.label, discovered: state.discovered.includes(f.key) })),
      notes: ctx.priv.counterpart.privateNotes,
    },
    aiAssessed: false,
  }
}

export function weakestDimension(e: Evaluation): Dimension {
  return [...DIMENSIONS].sort((a, b) => e.dimensions[a].score - e.dimensions[b].score)[0]!
}

export function checkChallenge(e: Evaluation, criteria: ChallengeCriteria, ctx: ScenarioContext): { label: string; met: boolean }[] {
  const out: { label: string; met: boolean }[] = []
  if (criteria.requireAgreement) out.push({ label: 'Reach an agreement', met: e.facts.outcome === 'AGREEMENT' })
  if (criteria.requireWalkAway) out.push({ label: 'Walk away deliberately', met: e.facts.outcome === 'PLAYER_WALKED' })
  if (criteria.maxTurns) out.push({ label: `Finish within ${criteria.maxTurns} turns`, met: e.facts.turns <= criteria.maxTurns })
  if (criteria.minOutcome) out.push({ label: `Outcome score of at least ${criteria.minOutcome}`, met: e.dimensions.outcome.score >= criteria.minOutcome })
  if (criteria.minRelationship) out.push({ label: `Relationship score of at least ${criteria.minRelationship}`, met: e.dimensions.relationship.score >= criteria.minRelationship })
  for (const k of criteria.mustDiscover ?? []) {
    const f = ctx.priv.counterpart.facts.find((x) => x.key === k)
    out.push({ label: `Discover the hidden constraint${f ? ` (${f.issue ? f.issue : 'key fact'})` : ''}`, met: e.revealed.hiddenFacts.some((h) => h.key === k && h.discovered) })
  }
  if (criteria.limitIssue) {
    const issue = ctx.pub.issues.find((i) => i.key === criteria.limitIssue!.key)!
    const v = e.facts.agreement?.[issue.key]
    const lim = criteria.limitIssue.max ?? criteria.limitIssue.min!
    const ok = v !== undefined && (criteria.limitIssue.max !== undefined ? v <= criteria.limitIssue.max : v >= criteria.limitIssue.min!)
    out.push({ label: `${issue.label} ${criteria.limitIssue.max !== undefined ? 'at most' : 'at least'} ${formatValue(issue, lim)}`, met: ok })
  }
  return out
}
