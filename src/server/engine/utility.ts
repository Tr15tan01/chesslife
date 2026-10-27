import type { Issue, ScenarioPublic, Terms } from '@/lib/negotiation/types'
import { roundToStep } from '@/lib/negotiation/format'
import type { ScenarioPrivate } from './private-types'

export type ScenarioContext = { pub: ScenarioPublic; priv: ScenarioPrivate }

/** Is `a` better than `b` for the player on this issue? */
export function playerBetter(issue: Issue, a: number, b: number): boolean {
  return issue.playerPrefers === 'higher' ? a > b : a < b
}

/** Whether a zone of possible agreement exists on an issue. */
export function issueZopa(ctx: ScenarioContext, key: string): boolean {
  const issue = ctx.pub.issues.find((i) => i.key === key)!
  const pLimit = ctx.pub.brief.limits[key]!
  const cLimit = ctx.priv.counterpart.limit[key]!
  // Player's limit must be at least as good for the counterpart as the counterpart's own limit.
  return issue.playerPrefers === 'higher' ? cLimit >= pLimit : cLimit <= pLimit
}

export function zopaExists(ctx: ScenarioContext): boolean {
  return ctx.pub.issues.every((i) => issueZopa(ctx, i.key))
}

function playerWeights(ctx: ScenarioContext): Record<string, number> {
  const total = ctx.pub.issues.reduce((s, i) => s + (ctx.pub.brief.priorities[i.key] ?? 2), 0)
  return Object.fromEntries(ctx.pub.issues.map((i) => [i.key, (ctx.pub.brief.priorities[i.key] ?? 2) / total]))
}

/**
 * Player utility on one issue: 0 at the player's own limit, 1 at the best the
 * counterpart could ever concede (their hidden limit). Can be negative.
 */
export function playerIssueUtility(ctx: ScenarioContext, issue: Issue, v: number): number {
  const pL = ctx.pub.brief.limits[issue.key]!
  const cL = ctx.priv.counterpart.limit[issue.key]!
  const range = issue.max - issue.min || 1
  const dir = issue.playerPrefers === 'higher' ? 1 : -1
  let best = cL
  if (!issueZopa(ctx, issue.key) || Math.abs(cL - pL) < range * 0.02) best = pL + dir * range * 0.1
  return (v - pL) / (best - pL)
}

export function playerUtility(ctx: ScenarioContext, terms: Terms): number {
  const w = playerWeights(ctx)
  let u = 0
  for (const issue of ctx.pub.issues) {
    const v = terms[issue.key]
    if (v === undefined) continue
    u += w[issue.key]! * playerIssueUtility(ctx, issue, v)
  }
  return u
}

/** Counterpart utility on one issue: 1 at their target, 0 at their limit, negative beyond. */
export function cpIssueUtility(ctx: ScenarioContext, issue: Issue, v: number): number {
  const t = ctx.priv.counterpart.target[issue.key]!
  const l = ctx.priv.counterpart.limit[issue.key]!
  if (t === l) return v === t ? 1 : playerBetter(issue, v, t) ? -1 : 1
  return (v - l) / (t - l)
}

export function cpUtility(ctx: ScenarioContext, terms: Terms): number {
  let u = 0
  for (const issue of ctx.pub.issues) {
    const v = terms[issue.key]
    if (v === undefined) continue
    u += (ctx.priv.counterpart.weights[issue.key] ?? 0) * cpIssueUtility(ctx, issue, v)
  }
  return u
}

export function withinCounterpartLimits(ctx: ScenarioContext, terms: Terms): boolean {
  return ctx.pub.issues.every((i) => terms[i.key] !== undefined && cpIssueUtility(ctx, i, terms[i.key]!) >= -1e-9)
}

export function withinPlayerLimits(ctx: ScenarioContext, terms: Terms): boolean {
  return ctx.pub.issues.every((i) => {
    const v = terms[i.key]
    if (v === undefined) return false
    const lim = ctx.pub.brief.limits[i.key]!
    return v === lim || playerBetter(i, v, lim)
  })
}

/** Round a value so rounding never crosses the counterpart's limit. */
export function roundForCounterpart(ctx: ScenarioContext, issue: Issue, v: number): number {
  let r = roundToStep(issue, v)
  if (cpIssueUtility(ctx, issue, r) < 0) {
    const l = ctx.priv.counterpart.limit[issue.key]!
    r = roundToStep(issue, l)
    if (cpIssueUtility(ctx, issue, r) < 0) r = roundToStep(issue, issue.playerPrefers === 'higher' ? r - issue.step : r + issue.step)
  }
  return r
}

/**
 * Best joint value achievable (sum of both sides' utilities), used to judge
 * value creation. Grid search is fine: scenarios have at most four issues.
 */
export function bestJointValue(ctx: ScenarioContext): number {
  const issues = ctx.pub.issues
  const grids = issues.map((i) => {
    const pL = ctx.pub.brief.limits[i.key]!
    const cL = ctx.priv.counterpart.limit[i.key]!
    const lo = Math.min(pL, cL)
    const hi = Math.max(pL, cL)
    const n = 6
    return Array.from({ length: n + 1 }, (_, k) => lo + ((hi - lo) * k) / n)
  })
  let best = -Infinity
  const walk = (idx: number, acc: Terms) => {
    if (idx === issues.length) {
      if (!withinCounterpartLimits(ctx, acc) || !withinPlayerLimits(ctx, acc)) return
      best = Math.max(best, playerUtility(ctx, acc) + cpUtility(ctx, acc))
      return
    }
    for (const v of grids[idx]!) walk(idx + 1, { ...acc, [issues[idx]!.key]: v })
  }
  walk(0, {})
  return Number.isFinite(best) ? best : 0
}
