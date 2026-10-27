import type { EngineState, Terms } from '@/lib/negotiation/types'
import {
  type ScenarioContext,
  cpIssueUtility,
  cpUtility,
  roundForCounterpart,
  withinCounterpartLimits,
} from './utility'

/** Flexibility unlocked by facts the player has discovered. */
export function factFlex(ctx: ScenarioContext, state: EngineState): number {
  return ctx.priv.counterpart.facts
    .filter((f) => state.discovered.includes(f.key))
    .reduce((s, f) => s + (f.flex ?? 0), 0)
}

/**
 * The utility the counterpart currently holds out for. Time-dependent
 * concession (Faratin-style): `firmness` > 1 concedes late (hard-liner),
 * < 1 concedes early. Trust, rationale and discovered facts move the floor.
 */
/** Lowest utility the counterpart will ever accept, given rapport and discoveries. */
export function effectiveFloor(ctx: ScenarioContext, state: EngineState): number {
  return Math.max(0, Math.min(0.95, ctx.priv.counterpart.floor - state.flex - factFlex(ctx, state)))
}

export function aspiration(ctx: ScenarioContext, state: EngineState, turnOverride?: number): number {
  const cp = ctx.priv.counterpart
  const T = Math.max(2, cp.patience)
  const t = Math.min(T, turnOverride ?? state.clock)
  const floor = effectiveFloor(ctx, state)
  const progress = Math.pow(t / T, cp.firmness)
  const trustAdj = (50 - state.trust) / 250
  return Math.max(floor, Math.min(1, floor + (1 - floor) * (1 - progress) + Math.max(-0.05, trustAdj)))
}

function issueSpeeds(ctx: ScenarioContext, boostKey?: string): Record<string, number> {
  const w = ctx.priv.counterpart.weights
  const ws = ctx.pub.issues.map((i) => w[i.key] ?? 0)
  const max = Math.max(...ws)
  const min = Math.min(...ws)
  const out: Record<string, number> = {}
  for (const i of ctx.pub.issues) {
    const wi = w[i.key] ?? 0
    out[i.key] = max === min ? 1 : 0.35 + 0.65 * ((max - wi) / (max - min))
    if (boostKey === i.key) out[i.key] = 1.6
  }
  return out
}

/**
 * Build the counterpart's next offer: start from its previous position and
 * move toward what the player asked for, conceding fastest on the issues it
 * cares least about (log-rolling), never past its limits and never retracting.
 */
export function nextCounterOffer(ctx: ScenarioContext, state: EngineState, opts: { target?: number; boostIssue?: string } = {}): Terms {
  const cp = ctx.priv.counterpart
  const prev = state.counterOffer ?? cp.opening
  const goal: Terms = {}
  for (const i of ctx.pub.issues) goal[i.key] = state.playerOffer?.[i.key] ?? cp.limit[i.key]!
  const A = opts.target ?? aspiration(ctx, state)
  const speeds = issueSpeeds(ctx, opts.boostIssue)

  const candidate = (lambda: number): Terms => {
    const out: Terms = {}
    for (const i of ctx.pub.issues) {
      const c = prev[i.key]!
      const p = goal[i.key]!
      // If the player asks for something that's better for us, take it.
      if (state.playerOffer && cpIssueUtility(ctx, i, p) >= cpIssueUtility(ctx, i, c)) {
        out[i.key] = roundForCounterpart(ctx, i, p)
        continue
      }
      const move = Math.min(1, lambda * speeds[i.key]!)
      let x = c + move * (p - c)
      if (cpIssueUtility(ctx, i, x) < 0) x = cp.limit[i.key]!
      out[i.key] = roundForCounterpart(ctx, i, x)
    }
    return out
  }

  if (cpUtility(ctx, candidate(0)) <= A) return candidate(0)
  let lo = 0
  // Slow issues need a larger lambda before they reach the player's ask.
  let hi = 1 / Math.max(0.05, Math.min(...Object.values(speeds)))
  if (cpUtility(ctx, candidate(hi)) >= A) return candidate(hi)
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2
    if (cpUtility(ctx, candidate(mid)) >= A) lo = mid
    else hi = mid
  }
  return candidate(lo)
}

export type AcceptDecision = { accept: boolean; reason: 'limits' | 'aspiration' | 'ok' }

export function evaluatePlayerOffer(ctx: ScenarioContext, state: EngineState, offer: Terms): AcceptDecision {
  if (!withinCounterpartLimits(ctx, offer)) return { accept: false, reason: 'limits' }
  const A = aspiration(ctx, state)
  const u = cpUtility(ctx, offer)
  if (u >= A - 0.02) return { accept: true, reason: 'ok' }
  // Accept-next rule: if the offer beats what we'd propose next, take it.
  const next = nextCounterOffer(ctx, { ...state, playerOffer: offer })
  if (u >= cpUtility(ctx, next) - 1e-9) return { accept: true, reason: 'ok' }
  return { accept: false, reason: 'aspiration' }
}

/** Extreme anchors (far past the counterpart's limits) cost trust. */
export function isExtreme(ctx: ScenarioContext, offer: Terms): boolean {
  return cpUtility(ctx, offer) < -0.6
}
