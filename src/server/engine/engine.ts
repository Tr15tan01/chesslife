import type { EngineState, OutcomeKind, Phase, ScenarioPublic, Terms, Turn, GameStatus } from '@/lib/negotiation/types'
import { clampTerms, formatTerms } from '@/lib/negotiation/format'
import { LINES, fill, pick } from './lines'
import type { QuestionNode, ScenarioPrivate, StatementNode } from './private-types'
import { effectiveFloor, evaluatePlayerOffer, isExtreme, nextCounterOffer } from './counterpart'
import { type ScenarioContext, cpUtility, playerBetter } from './utility'

/**
 * Pure, deterministic negotiation state machine shared by every mode.
 * The service layer handles persistence, ownership, timing and AI wording;
 * this module decides what actually happens.
 */

export type PlayerAction =
  | { type: 'ASK'; questionKey: string }
  | { type: 'STATEMENT'; statementKey: string }
  | { type: 'MESSAGE'; text: string }
  | { type: 'MAKE_OFFER'; terms: Terms; message?: string }
  | { type: 'REQUEST_CONCESSION'; issueKey: string }
  | { type: 'ACCEPT' }
  | { type: 'REJECT' }
  | { type: 'WALK_AWAY' }

export type Signals = {
  question?: string | null
  rationale?: boolean
  empathy?: boolean
  pressure?: boolean
  bluff?: boolean
  summary?: boolean
  tradeoff?: boolean
}

export type StepResult = {
  state: EngineState
  turns: Omit<Turn, 'idx' | 'at'>[]
  status: GameStatus
  outcome: { kind: OutcomeKind; terms: Terms | null } | null
}

export const BUILTIN_QUESTIONS = {
  proposal: { key: 'proposal', prompt: 'What would you propose?', kind: 'leading' as const },
  priorities: { key: 'priorities', prompt: 'What matters most to you here?', kind: 'interest' as const },
}

export const BUILTIN_STATEMENTS = {
  summary: { key: 'summary', text: 'Let me summarise where we are so far.', kind: 'summary' as const },
  pressure: { key: 'pressure', text: "I have other options. Take it or leave it.", kind: 'pressure' as const },
}

export function initialState(ctx: ScenarioContext): EngineState {
  return {
    turn: 0,
    clock: 0,
    phase: 'OPENING',
    trust: ctx.priv.counterpart.trustStart,
    flex: 0,
    discovered: [],
    asked: [],
    used: [],
    offers: [],
    playerOffer: null,
    counterOffer: null,
    finalOfferIssued: false,
    counts: { questions: 0, rationale: 0, empathy: 0, pressure: 0, bluff: 0, rejects: 0, concessionRequests: 0, tradeoffs: 0, messages: 0 },
    agreement: null,
  }
}

export function openingTurns(ctx: ScenarioContext): Omit<Turn, 'idx' | 'at'>[] {
  return [{ actor: 'counterpart', action: 'START', text: ctx.pub.opening, source: 'rules' }]
}

const clampTrust = (t: number) => Math.max(0, Math.min(100, Math.round(t)))

function seedOf(ctx: ScenarioContext, state: EngineState): number {
  let h = state.turn * 31
  for (const ch of ctx.pub.slug) h = (h * 33 + ch.charCodeAt(0)) | 0
  return h
}

function phaseFor(state: EngineState, terminal: boolean): Phase {
  if (terminal) return 'CLOSED'
  if (state.finalOfferIssued) return 'CLOSING'
  if (state.offers.length > 0) return 'BARGAINING'
  if (state.turn >= 1) return 'EXPLORATION'
  return 'OPENING'
}

/** Questions the player may choose right now (branching: some need a discovered fact). */
export function availableQuestions(ctx: ScenarioContext, state: EngineState) {
  const authored = ctx.priv.questions
    .filter((q) => !q.requires || state.discovered.includes(q.requires))
    .map((q) => ({ key: q.key, prompt: q.prompt, kind: q.kind, asked: state.asked.includes(q.key) }))
  const builtins = [BUILTIN_QUESTIONS.proposal, ...(ctx.pub.issues.length > 1 ? [BUILTIN_QUESTIONS.priorities] : [])].map((q) => ({
    ...q,
    asked: state.asked.includes(q.key),
  }))
  return [...builtins, ...authored]
}

export function availableStatements(ctx: ScenarioContext, state: EngineState) {
  const authored = ctx.priv.statements
    .filter((s) => !s.requires || state.discovered.includes(s.requires))
    .map((s) => ({ key: s.key, text: s.text, kind: s.kind, used: state.used.includes(s.key) }))
  const builtins = [BUILTIN_STATEMENTS.summary, BUILTIN_STATEMENTS.pressure].map((s) => ({ ...s, used: state.used.includes(s.key) }))
  return [...authored, ...builtins]
}

function topPriorityLabel(ctx: ScenarioContext): string {
  const [key] = Object.entries(ctx.priv.counterpart.weights).sort((a, b) => b[1] - a[1])[0] ?? []
  return ctx.pub.issues.find((i) => i.key === key)?.label.toLowerCase() ?? 'the main terms'
}

/** Keyword match for Classic free text. Honest about its limits. */
export function matchFreeText(ctx: ScenarioContext, state: EngineState, text: string): { kind: 'question'; node: QuestionNode } | { kind: 'statement'; node: StatementNode } | null {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9\s']/g, ' ')} `
  let best: { score: number; res: ReturnType<typeof matchFreeText> } = { score: 0, res: null }
  for (const q of ctx.priv.questions) {
    if (q.requires && !state.discovered.includes(q.requires)) continue
    const score = q.keywords.filter((k) => t.includes(` ${k.toLowerCase()}`)).length
    if (score > best.score) best = { score, res: { kind: 'question', node: q } }
  }
  for (const s of ctx.priv.statements) {
    if (s.requires && !state.discovered.includes(s.requires)) continue
    const score = s.keywords.filter((k) => t.includes(` ${k.toLowerCase()}`)).length
    if (score > best.score) best = { score, res: { kind: 'statement', node: s } }
  }
  return best.res
}

type Draft = { state: EngineState; turns: Omit<Turn, 'idx' | 'at'>[] }

function say(d: Draft, text: string, extra: Partial<Turn> = {}) {
  d.turns.push({ actor: 'counterpart', action: 'REPLY', text, source: 'rules', ...extra })
}

function answerQuestion(ctx: ScenarioContext, d: Draft, key: string) {
  const s = d.state
  if (key === 'proposal') {
    const already = s.asked.includes('proposal')
    s.counts.questions++
    if (!already) s.asked.push('proposal')
    if (!s.counterOffer) {
      const offer = { ...ctx.priv.counterpart.opening }
      s.counterOffer = offer
      s.offers.push({ turn: s.turn, terms: offer, by: 'counterpart' })
      say(d, `My starting point would be ${formatTerms(ctx.pub.issues, offer)}.`, { action: 'COUNTER', offer })
    } else {
      say(d, `My current position is ${formatTerms(ctx.pub.issues, s.counterOffer)}.`, { offer: s.counterOffer })
    }
    return
  }
  if (key === 'priorities') {
    s.counts.questions++
    if (!s.asked.includes('priorities')) {
      s.asked.push('priorities')
      s.trust = clampTrust(s.trust + 3)
      if (!s.discovered.includes('priorities')) s.discovered.push('priorities')
      const txt = `Honestly? ${topPriorityLabel(ctx).replace(/^./, (c) => c.toUpperCase())} matters most to me. I have more room on the rest.`
      say(d, txt, { revealed: [{ key: 'priorities', text: `Their top priority is ${topPriorityLabel(ctx)}.` }] })
    } else {
      s.trust = clampTrust(s.trust - 1)
      say(d, pick(LINES[ctx.pub.counterpart.style].repeatQuestion, seedOf(ctx, s)))
    }
    return
  }
  const q = ctx.priv.questions.find((x) => x.key === key)
  if (!q || (q.requires && !s.discovered.includes(q.requires))) {
    d.turns.push({ actor: 'system', action: 'SYSTEM', text: 'That question is not available right now.' })
    return
  }
  s.counts.questions++
  if (s.asked.includes(q.key)) {
    s.trust = clampTrust(s.trust - 1)
    say(d, pick(LINES[ctx.pub.counterpart.style].repeatQuestion, seedOf(ctx, s)))
    return
  }
  const fact = q.reveals ? ctx.priv.counterpart.facts.find((f) => f.key === q.reveals) : undefined
  s.trust = clampTrust(s.trust + (q.trust ?? (q.kind === 'rapport' ? 5 : 2)))
  if (fact && s.trust < fact.trustRequired) {
    // Deflect; the player can come back to it once rapport is higher.
    say(d, q.deflection ?? "I'd rather not get into that right now.", { note: 'They deflected. Building rapport may open this up.' })
    return
  }
  s.asked.push(q.key)
  const revealed = fact && !s.discovered.includes(fact.key) ? [{ key: fact.key, text: fact.label }] : undefined
  if (fact && !s.discovered.includes(fact.key)) s.discovered.push(fact.key)
  say(d, q.answer, { revealed })
}

function makeStatement(ctx: ScenarioContext, d: Draft, key: string) {
  const s = d.state
  const style = ctx.pub.counterpart.style
  if (key === 'summary') {
    s.counts.rationale += 0
    if (!s.used.includes('summary')) {
      s.used.push('summary')
      s.trust = clampTrust(s.trust + 2)
    }
    const known = s.discovered.length
    say(d, known > 0 ? "That's a fair summary. Glad you were listening." : "Fair enough. Though I'm not sure you know where I stand yet.")
    return
  }
  if (key === 'pressure') {
    s.counts.pressure++
    s.used.push('pressure')
    const harsh = style === 'skeptical' || style === 'impatient' || style === 'strategic'
    s.trust = clampTrust(s.trust - (harsh ? 12 : 8))
    s.flex += harsh ? 0 : 0.02
    say(d, pick(LINES[style].pressureReply, seedOf(ctx, s)))
    return
  }
  const st = ctx.priv.statements.find((x) => x.key === key)
  if (!st || (st.requires && !s.discovered.includes(st.requires))) {
    d.turns.push({ actor: 'system', action: 'SYSTEM', text: 'That point is not available right now.' })
    return
  }
  if (s.used.includes(st.key)) {
    s.trust = clampTrust(s.trust - 1)
    say(d, "You've made that point already.")
    return
  }
  s.used.push(st.key)
  if (st.kind === 'rationale' || st.kind === 'commitment') s.counts.rationale++
  if (st.kind === 'empathy') s.counts.empathy++
  if (st.kind === 'pressure') s.counts.pressure++
  if (st.kind === 'bluff') s.counts.bluff++
  s.trust = clampTrust(s.trust + st.trust)
  s.flex = Math.max(0, s.flex + st.flex)
  say(d, st.reply)
}

function counterpartWalks(ctx: ScenarioContext, d: Draft): StepResult {
  const s = d.state
  d.turns.push({ actor: 'counterpart', action: 'COUNTERPART_WALK', text: ctx.priv.counterpart.lines.walk, source: 'rules' })
  s.phase = 'CLOSED'
  return { state: s, turns: d.turns, status: 'FAILED', outcome: { kind: 'COUNTERPART_WALKED', terms: null } }
}

function agree(ctx: ScenarioContext, d: Draft, terms: Terms, by: 'player' | 'counterpart'): StepResult {
  const s = d.state
  s.agreement = terms
  s.phase = 'CLOSED'
  if (by === 'counterpart') {
    d.turns.push({ actor: 'counterpart', action: 'COUNTERPART_ACCEPT', text: ctx.priv.counterpart.lines.accept, offer: terms, source: 'rules' })
  }
  return { state: s, turns: d.turns, status: 'AGREEMENT_REACHED', outcome: { kind: 'AGREEMENT', terms } }
}

function maybeFinal(ctx: ScenarioContext, d: Draft): StepResult | null {
  const s = d.state
  const cp = ctx.priv.counterpart
  if (s.trust < cp.walkTrust) return counterpartWalks(ctx, d)
  if (!s.finalOfferIssued && s.offers.length > 0 && s.clock >= cp.patience) {
    const target = effectiveFloor(ctx, s)
    const offer = nextCounterOffer(ctx, s, { target })
    s.counterOffer = offer
    s.finalOfferIssued = true
    s.offers.push({ turn: s.turn, terms: offer, by: 'counterpart' })
    d.turns.push({
      actor: 'counterpart',
      action: 'COUNTER',
      text: `${cp.lines.finalOffer} ${formatTerms(ctx.pub.issues, offer)}.`,
      offer,
      source: 'rules',
      note: 'Final offer. Accept it, make one last offer, or walk away.',
    })
  }
  return null
}

function isTradeoff(ctx: ScenarioContext, prev: Terms | null, next: Terms): boolean {
  if (!prev || ctx.pub.issues.length < 2) return false
  let gave = false
  let took = false
  for (const i of ctx.pub.issues) {
    const a = prev[i.key]!
    const b = next[i.key]!
    if (a === b) continue
    if (playerBetter(i, b, a)) took = true
    else gave = true
  }
  return gave && took
}

/** Rapport effects of observed communication (from AI classification). Mutates `s`. */
export function applySignalsTo(s: EngineState, signals: Signals) {
  if (signals.empathy) {
    s.counts.empathy++
    s.trust = clampTrust(s.trust + 4)
  }
  if (signals.rationale) {
    s.counts.rationale++
    s.trust = clampTrust(s.trust + 2)
    s.flex += 0.02
  }
  if (signals.pressure) {
    s.counts.pressure++
    s.trust = clampTrust(s.trust - 8)
  }
  if (signals.bluff) {
    s.counts.bluff++
    s.trust = clampTrust(s.trust - 4)
  }
  if (signals.summary && !s.used.includes('summary')) {
    s.used.push('summary')
    s.trust = clampTrust(s.trust + 2)
  }
}

export type StepOptions = { freeText?: 'keywords' | 'external' }

export function step(ctx: ScenarioContext, current: EngineState, action: PlayerAction, signals: Signals = {}, opts: StepOptions = {}): StepResult {
  const d: Draft = { state: structuredClone(current), turns: [] }
  const s = d.state
  const style = ctx.pub.counterpart.style
  const L = LINES[style]

  if (action.type === 'WALK_AWAY') {
    d.turns.push({ actor: 'player', action: 'WALK_AWAY', text: 'I am going to walk away from this one.' })
    s.phase = 'CLOSED'
    return { state: s, turns: d.turns, status: 'WALKED_AWAY', outcome: { kind: 'PLAYER_WALKED', terms: null } }
  }

  if (action.type === 'ACCEPT') {
    if (!s.counterOffer) {
      d.turns.push({ actor: 'system', action: 'SYSTEM', text: 'There is no offer on the table to accept yet.' })
      return { state: current, turns: d.turns, status: 'ACTIVE', outcome: null }
    }
    d.turns.push({ actor: 'player', action: 'ACCEPT', text: `I accept: ${formatTerms(ctx.pub.issues, s.counterOffer)}.`, offer: s.counterOffer })
    s.turn++
    return agree(ctx, d, s.counterOffer, 'player')
  }

  s.turn++
  s.clock = Number((s.clock + (action.type === 'MAKE_OFFER' || action.type === 'REQUEST_CONCESSION' || action.type === 'REJECT' ? 1 : 0.35)).toFixed(2))

  const applySignals = () => applySignalsTo(s, signals)

  switch (action.type) {
    case 'ASK': {
      const label = availableQuestions(ctx, s).find((q) => q.key === action.questionKey)?.prompt ?? action.questionKey
      d.turns.push({ actor: 'player', action: 'ASK', text: label, ref: action.questionKey })
      answerQuestion(ctx, d, action.questionKey)
      break
    }
    case 'STATEMENT': {
      const label = availableStatements(ctx, s).find((x) => x.key === action.statementKey)?.text ?? action.statementKey
      d.turns.push({ actor: 'player', action: 'STATEMENT', text: label, ref: action.statementKey })
      makeStatement(ctx, d, action.statementKey)
      break
    }
    case 'MESSAGE': {
      s.counts.messages++
      d.turns.push({ actor: 'player', action: 'MESSAGE', text: action.text })
      applySignals()
      if (signals.question) {
        answerQuestion(ctx, d, signals.question)
        break
      }
      const m = opts.freeText === 'external' ? null : matchFreeText(ctx, s, action.text)
      if (m?.kind === 'question') {
        answerQuestion(ctx, d, m.node.key)
        d.turns[d.turns.length - 1]!.note = `Matched to: “${m.node.prompt}”`
      } else if (m?.kind === 'statement') {
        makeStatement(ctx, d, m.node.key)
        d.turns[d.turns.length - 1]!.note = `Matched to: “${m.node.text}”`
      } else if (opts.freeText !== 'external' && !Object.values(signals).some(Boolean)) {
        say(d, pick(L.noted, seedOf(ctx, s)), {
          note: 'Classic mode matches free text to keywords only. Use the question and point lists for precise moves.',
        })
      } else {
        say(d, pick(L.noted, seedOf(ctx, s)))
      }
      break
    }
    case 'MAKE_OFFER': {
      const terms = clampTerms(ctx.pub.issues, action.terms)
      if (Object.keys(terms).length !== ctx.pub.issues.length) {
        d.turns.push({ actor: 'system', action: 'SYSTEM', text: 'An offer must include every issue.' })
        return { state: current, turns: d.turns, status: 'ACTIVE', outcome: null }
      }
      applySignals()
      const prevOwn = s.playerOffer
      if (isTradeoff(ctx, prevOwn, terms) || signals.tradeoff) {
        s.counts.tradeoffs++
        s.trust = clampTrust(s.trust + 3)
        s.flex += 0.02
      }
      d.turns.push({
        actor: 'player',
        action: 'MAKE_OFFER',
        text: action.message?.trim() ? action.message.trim() : `I propose ${formatTerms(ctx.pub.issues, terms)}.`,
        offer: terms,
      })
      s.playerOffer = terms
      s.offers.push({ turn: s.turn, terms, by: 'player' })

      const decision = evaluatePlayerOffer(ctx, s, terms)
      if (decision.accept) return agree(ctx, d, terms, 'counterpart')

      if (s.finalOfferIssued) return counterpartWalks(ctx, d)

      const extreme = isExtreme(ctx, terms)
      if (extreme) s.trust = clampTrust(s.trust - 6)
      const prevCounter = s.counterOffer
      const counter = nextCounterOffer(ctx, s)
      const moved = !prevCounter || cpUtility(ctx, counter) < cpUtility(ctx, prevCounter) - 1e-9
      s.counterOffer = counter
      s.offers.push({ turn: s.turn, terms: counter, by: 'counterpart' })
      const offerTxt = formatTerms(ctx.pub.issues, counter)
      const line = extreme ? `${pick(L.limits, seedOf(ctx, s))} ${fill(pick(L.hold, seedOf(ctx, s)), offerTxt)}` : fill(pick(moved ? L.counter : L.hold, seedOf(ctx, s)), offerTxt)
      say(d, line, { action: 'COUNTER', offer: counter })
      break
    }
    case 'REQUEST_CONCESSION': {
      const issue = ctx.pub.issues.find((i) => i.key === action.issueKey)
      d.turns.push({
        actor: 'player',
        action: 'REQUEST_CONCESSION',
        text: issue ? `Can you do better on ${issue.label.toLowerCase()}?` : 'Can you do better?',
        ref: action.issueKey,
      })
      s.counts.concessionRequests++
      if (!s.counterOffer || !issue) {
        say(d, pick(L.rejectNoCounter, seedOf(ctx, s)))
        break
      }
      const askingWithoutGiving = s.counts.concessionRequests > 2 && s.offers.filter((o) => o.by === 'player').length === 0
      if (askingWithoutGiving) s.trust = clampTrust(s.trust - 3)
      const prev = s.counterOffer
      const next = nextCounterOffer(ctx, { ...s, playerOffer: s.playerOffer ?? null }, { boostIssue: issue.key })
      // Only move the requested issue; keep the rest where it was.
      const proposal: Terms = { ...prev, [issue.key]: next[issue.key]! }
      const improved = playerBetter(issue, proposal[issue.key]!, prev[issue.key]!) && s.trust >= 35
      if (improved && cpUtility(ctx, proposal) >= effectiveFloor(ctx, s) - 1e-9) {
        s.counterOffer = proposal
        s.offers.push({ turn: s.turn, terms: proposal, by: 'counterpart' })
        say(d, fill(pick(L.concessionYes, seedOf(ctx, s)), formatTerms(ctx.pub.issues, proposal)), { action: 'COUNTER', offer: proposal })
      } else {
        say(d, pick(L.concessionNo, seedOf(ctx, s)))
      }
      break
    }
    case 'REJECT': {
      d.turns.push({ actor: 'player', action: 'REJECT', text: "That doesn't work for me." })
      s.counts.rejects++
      s.trust = clampTrust(s.trust - 2)
      if (s.finalOfferIssued) return counterpartWalks(ctx, d)
      say(d, pick(L.rejectNoCounter, seedOf(ctx, s)))
      break
    }
  }

  if (s.finalOfferIssued && action.type !== 'MAKE_OFFER' && current.finalOfferIssued) {
    // The player ignored a final offer.
    return counterpartWalks(ctx, d)
  }

  const fin = maybeFinal(ctx, d)
  if (fin) return fin

  if (s.turn >= ctx.pub.maxTurns) {
    d.turns.push({ actor: 'system', action: 'SYSTEM', text: 'The conversation ran out of time without an agreement.' })
    s.phase = 'CLOSED'
    return { state: s, turns: d.turns, status: 'FAILED', outcome: { kind: 'NO_DEAL', terms: null } }
  }

  s.phase = phaseFor(s, false)
  return { state: s, turns: d.turns, status: 'ACTIVE', outcome: null }
}

/** Timed mode: called by the service when the server deadline has passed. */
export function expire(current: EngineState): StepResult {
  const s = structuredClone(current)
  s.phase = 'CLOSED'
  return {
    state: s,
    turns: [{ actor: 'system', action: 'EXPIRE', text: 'Time is up. The negotiation ended without an agreement.' }],
    status: 'EXPIRED',
    outcome: { kind: 'EXPIRED', terms: null },
  }
}

export type { ScenarioContext, ScenarioPrivate, ScenarioPublic }
