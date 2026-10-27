'use client'

import type { ReactNode } from 'react'

/** Shared chart chrome: title, legend, tooltip and an accessible table view. */
export const SERIES = { s1: 'var(--series-1)', s2: 'var(--series-2)', s3: 'var(--series-3)' } as const

export const axisProps = {
  stroke: 'var(--line)',
  tick: { fill: 'var(--ink-3)', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: 'var(--line)' },
} as const

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  if (items.length < 2) return null
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

type TipPayload = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }

export function ChartTooltip({ active, payload, label, format, labelFormat }: { active?: boolean; payload?: TipPayload[]; label?: string | number; format?: (v: number, key: string) => string; labelFormat?: (l: string | number, p?: Record<string, unknown>) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-[10px] px-3 py-2 text-[12.5px] shadow-md">
      {label !== undefined && <p className="mb-1 text-ink-3">{labelFormat ? labelFormat(label, payload[0]?.payload) : label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-ink">
          <span className="inline-block size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="text-ink-2">{p.name}</span>
          <span className="tabular ml-auto pl-3 font-medium">{typeof p.value === 'number' ? (format ? format(p.value, String(p.dataKey)) : p.value) : (p.value ?? '—')}</span>
        </p>
      ))}
    </div>
  )
}

export function ChartFrame({ title, description, legend, children, table, actions }: { title: string; description?: ReactNode; legend?: { label: string; color: string }[]; children: ReactNode; table?: { headers: string[]; rows: (string | number | null)[][] }; actions?: ReactNode }) {
  return (
    <figure className="panel flex flex-col p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <figcaption className="font-display text-[1.25rem] font-[450] text-ink">{title}</figcaption>
          {description && <p className="mt-1 text-[13px] text-ink-3">{description}</p>}
        </div>
        {actions}
      </div>
      {legend && (
        <div className="mb-3">
          <Legend items={legend} />
        </div>
      )}
      <div className="min-h-0 flex-1">{children}</div>
      {table && table.rows.length > 0 && (
        <details className="mt-3 text-[13px]">
          <summary className="cursor-pointer text-ink-3 hover:text-ink">Show as table</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-ink-3">
                  {table.headers.map((h) => (
                    <th key={h} className="py-1.5 pr-4 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-line/60">
                    {r.map((c, j) => (
                      <td key={j} className="tabular py-1.5 pr-4 text-ink-2">
                        {c ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  )
}
