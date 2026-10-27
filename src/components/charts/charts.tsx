'use client'

import { useRouter } from 'next/navigation'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CATEGORY_LABELS, DIMENSION_SHORT, type Category, type Dimension } from '@/lib/negotiation/types'
import { ChartFrame, ChartTooltip, SERIES, axisProps } from './chart-kit'

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export function TrendChart({ data, title = 'Performance over time', height = 240 }: { data: { date: string; overall: number; outcome: number; gameId?: string; title?: string }[]; title?: string; height?: number }) {
  const router = useRouter()
  const rows = data.map((d, i) => ({ ...d, n: i + 1 }))
  return (
    <ChartFrame
      title={title}
      description="Overall score and outcome score per completed negotiation. Select a point to open that debrief."
      legend={[
        { label: 'Overall', color: SERIES.s1 },
        { label: 'Outcome', color: SERIES.s2 },
      ]}
      table={{ headers: ['#', 'Date', 'Scenario', 'Overall', 'Outcome'], rows: rows.map((r) => [r.n, shortDate(r.date), r.title ?? '', r.overall, r.outcome]) }}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="n" {...axisProps} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} {...axisProps} />
            <Tooltip cursor={{ stroke: 'var(--line-strong)' }} content={<ChartTooltip labelFormat={(_, p) => `${p?.title ?? 'Session'}, ${p?.date ? shortDate(String(p.date)) : ''}`} />} />
            <Line type="monotone" dataKey="overall" name="Overall" stroke={SERIES.s1} strokeWidth={2} dot={{ r: 4, fill: SERIES.s1, stroke: 'var(--surface)', strokeWidth: 2 }} activeDot={{ r: 6, onClick: (_: unknown, e: unknown) => { const id = (e as { payload?: { gameId?: string } })?.payload?.gameId; if (id) router.push(`/results/${id}`) }, style: { cursor: 'pointer' } }} isAnimationActive={false} />
            <Line type="monotone" dataKey="outcome" name="Outcome" stroke={SERIES.s2} strokeWidth={2} dot={{ r: 4, fill: SERIES.s2, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}

export function SkillBars({ data, title = 'Skill profile', description, height = 300 }: { data: { dimension: Dimension; score: number | null; second?: number | null }[]; title?: string; description?: string; height?: number }) {
  const hasSecond = data.some((d) => d.second !== undefined)
  const rows = data.map((d) => ({ name: DIMENSION_SHORT[d.dimension], score: d.score ?? 0, second: d.second ?? 0 }))
  return (
    <ChartFrame
      title={title}
      description={description ?? 'Average score per dimension across recent negotiations.'}
      legend={hasSecond ? [{ label: 'Rules-only games', color: SERIES.s1 }, { label: 'AI-assessed games', color: SERIES.s2 }] : undefined}
      table={{ headers: hasSecond ? ['Dimension', 'Rules-only', 'AI-assessed'] : ['Dimension', 'Average'], rows: data.map((d) => (hasSecond ? [DIMENSION_SHORT[d.dimension], d.score, d.second ?? null] : [DIMENSION_SHORT[d.dimension], d.score])) }}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }} barGap={2} barCategoryGap={hasSecond ? 8 : 10}>
            <CartesianGrid stroke="var(--grid)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} {...axisProps} />
            <YAxis type="category" dataKey="name" width={104} {...axisProps} axisLine={false} />
            <Tooltip cursor={{ fill: 'color-mix(in oklab, var(--ink) 5%, transparent)' }} content={<ChartTooltip />} />
            <Bar dataKey="score" name={hasSecond ? 'Rules-only' : 'Average'} fill={SERIES.s1} radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />
            {hasSecond && <Bar dataKey="second" name="AI-assessed" fill={SERIES.s2} radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}

export function ActivityBars({ data, height = 200, title = 'Training activity' }: { data: { week: string; games: number; lessons: number }[]; height?: number; title?: string }) {
  const rows = data.map((d) => ({ ...d, label: shortDate(d.week) }))
  return (
    <ChartFrame
      title={title}
      description="Completed negotiations and lessons per week."
      legend={[
        { label: 'Negotiations', color: SERIES.s1 },
        { label: 'Lessons', color: SERIES.s2 },
      ]}
      table={{ headers: ['Week of', 'Negotiations', 'Lessons'], rows: rows.map((r) => [r.label, r.games, r.lessons]) }}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -24 }} barGap={2}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip cursor={{ fill: 'color-mix(in oklab, var(--ink) 5%, transparent)' }} content={<ChartTooltip />} />
            <Bar dataKey="games" name="Negotiations" fill={SERIES.s1} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="lessons" name="Lessons" fill={SERIES.s2} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}

export function OutcomeStack({ data, height = 260 }: { data: { category: Category; agreements: number; walkAways: number; noDeal: number; avgScore: number | null }[]; height?: number }) {
  const rows = data.map((d) => ({ ...d, name: CATEGORY_LABELS[d.category] }))
  return (
    <ChartFrame
      title="Outcomes by category"
      description="How each negotiation ended. These are objective outcomes, not AI judgements."
      legend={[
        { label: 'Agreement', color: SERIES.s3 },
        { label: 'No deal', color: SERIES.s2 },
        { label: 'You walked away', color: SERIES.s1 },
      ]}
      table={{ headers: ['Category', 'Agreements', 'No deal', 'Walked away', 'Avg score'], rows: rows.map((r) => [r.name, r.agreements, r.noDeal, r.walkAways, r.avgScore]) }}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="name" {...axisProps} interval={0} tick={{ fill: 'var(--ink-3)', fontSize: 11 }} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip cursor={{ fill: 'color-mix(in oklab, var(--ink) 5%, transparent)' }} content={<ChartTooltip />} />
            <Bar dataKey="agreements" name="Agreement" stackId="o" fill={SERIES.s3} stroke="var(--surface)" strokeWidth={2} maxBarSize={36} isAnimationActive={false} />
            <Bar dataKey="noDeal" name="No deal" stackId="o" fill={SERIES.s2} stroke="var(--surface)" strokeWidth={2} maxBarSize={36} isAnimationActive={false} />
            <Bar dataKey="walkAways" name="You walked away" stackId="o" fill={SERIES.s1} stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}

export function DifficultyBars({ data, height = 220 }: { data: { difficulty: number; games: number; avgScore: number | null }[]; height?: number }) {
  const names = ['', 'Foundational', 'Intermediate', 'Advanced', 'Expert']
  const rows = data.map((d) => ({ name: names[d.difficulty], score: d.avgScore ?? 0, games: d.games }))
  return (
    <ChartFrame title="Score by difficulty" description="Average overall score at each difficulty level." table={{ headers: ['Difficulty', 'Games', 'Average score'], rows: data.map((d) => [names[d.difficulty]!, d.games, d.avgScore]) }}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="name" {...axisProps} interval={0} tick={{ fill: 'var(--ink-3)', fontSize: 11 }} />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} {...axisProps} />
            <Tooltip cursor={{ fill: 'color-mix(in oklab, var(--ink) 5%, transparent)' }} content={<ChartTooltip />} />
            <Bar dataKey="score" name="Average score" fill={SERIES.s1} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}

export function ConcessionLine({ data, height = 200 }: { data: { date: string; concessions: number; title: string }[]; height?: number }) {
  const rows = data.map((d, i) => ({ ...d, n: i + 1 }))
  return (
    <ChartFrame title="Concessions per negotiation" description="How many times you gave ground on your own offers. Fewer, smaller steps usually signal discipline." table={{ headers: ['#', 'Scenario', 'Concessions'], rows: rows.map((r) => [r.n, r.title, r.concessions]) }}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="n" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip cursor={{ stroke: 'var(--line-strong)' }} content={<ChartTooltip labelFormat={(_, p) => String(p?.title ?? '')} />} />
            <Line type="monotone" dataKey="concessions" name="Concessions" stroke={SERIES.s1} strokeWidth={2} dot={{ r: 4, fill: SERIES.s1, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
