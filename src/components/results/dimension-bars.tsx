import { DIMENSIONS, DIMENSION_LABELS, type DimensionScore, type Dimension } from '@/lib/negotiation/types'
import { cn } from '@/lib/cn'

/** Horizontal score bars for the eight evaluation dimensions. Server-renderable. */
export function DimensionBars({ dims, compact = false, showRationale = false }: { dims: Record<Dimension, DimensionScore>; compact?: boolean; showRationale?: boolean }) {
  return (
    <ul className={cn('grid', compact ? 'gap-2.5' : 'gap-4')}>
      {DIMENSIONS.map((d) => {
        const s = dims[d]
        return (
          <li key={d}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={cn('text-ink-2', compact ? 'text-[13px]' : 'text-sm')}>
                {DIMENSION_LABELS[d]}
                {s.source !== 'rules' && <span className="ml-2 rounded-full border border-s2/50 px-1.5 text-[11px] text-s2">AI-assessed</span>}
              </span>
              <span className="tabular text-sm font-medium text-ink">{s.score}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3" role="meter" aria-label={`${DIMENSION_LABELS[d]} score`} aria-valuenow={s.score} aria-valuemin={0} aria-valuemax={100}>
              <div className={cn('h-full rounded-full', s.score >= 70 ? 'bg-s3' : s.score >= 45 ? 'bg-s1' : 'bg-bad')} style={{ width: `${s.score}%` }} />
            </div>
            {showRationale && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{s.rationale}</p>}
          </li>
        )
      })}
    </ul>
  )
}
