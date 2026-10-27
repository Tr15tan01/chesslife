import type { Issue, Terms } from './types'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

export function formatValue(issue: Issue, value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  switch (issue.unit) {
    case 'currency':
      return money.format(value)
    case 'percent':
      return `${num.format(value)}%`
    case 'days':
      return `${num.format(value)} ${value === 1 ? 'day' : 'days'}`
    case 'weeks':
      return `${num.format(value)} ${value === 1 ? 'week' : 'weeks'}`
    case 'months':
      return `${num.format(value)} ${value === 1 ? 'month' : 'months'}`
    case 'hours':
      return `${num.format(value)} h`
    case 'clock': {
      const h = Math.floor(value) % 24
      const m = Math.round((value - Math.floor(value)) * 60)
      const ampm = h >= 12 ? 'pm' : 'am'
      const h12 = h % 12 === 0 ? 12 : h % 12
      return value >= 24 ? 'midnight' : `${h12}:${String(m).padStart(2, '0')} ${ampm}`
    }
    case 'choice':
      return issue.choices?.[Math.round(value)] ?? String(value)
    default:
      return num.format(value)
  }
}

export function formatTerms(issues: Issue[], terms: Terms | null | undefined): string {
  if (!terms) return '—'
  return issues
    .filter((i) => terms[i.key] !== undefined)
    .map((i) => (issues.length === 1 ? formatValue(i, terms[i.key]) : `${i.label}: ${formatValue(i, terms[i.key])}`))
    .join(', ')
}

export function roundToStep(issue: Issue, value: number): number {
  const steps = Math.round((value - issue.min) / issue.step)
  const v = issue.min + steps * issue.step
  const clamped = Math.min(issue.max, Math.max(issue.min, v))
  return Number(clamped.toFixed(4))
}

export function clampTerms(issues: Issue[], terms: Terms): Terms {
  const out: Terms = {}
  for (const i of issues) {
    const v = terms[i.key]
    if (typeof v === 'number' && Number.isFinite(v)) out[i.key] = roundToStep(i, v)
  }
  return out
}

export function rapportLabel(trust: number): { label: string; level: 0 | 1 | 2 | 3 } {
  if (trust >= 70) return { label: 'Warm', level: 3 }
  if (trust >= 50) return { label: 'Open', level: 2 }
  if (trust >= 30) return { label: 'Guarded', level: 1 }
  return { label: 'Strained', level: 0 }
}
