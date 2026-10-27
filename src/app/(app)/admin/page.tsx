import type { Metadata } from 'next'
import { Panel, PanelTitle } from '@/components/ui/misc'
import { requirePermission } from '@/server/auth/guard'
import { getStats } from '@/server/services/admin'
import { can } from '@/server/auth/permissions'

export const metadata: Metadata = { title: 'Admin' }

export default async function AdminHome() {
  const user = await requirePermission('admin:view')
  const s = await getStats(user)
  const totals = s.aiUsage.reduce((a, r) => ({ calls: a.calls + r.calls, failures: a.failures + r.failures, tokens: a.tokens + r.input + r.output, cost: a.cost + r.cost }), { calls: 0, failures: 0, tokens: 0, cost: 0 })
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ['Registered users', s.users],
          ['New this week', s.newUsers],
          ['Games played', s.games],
          ['Completed this week', s.completed7],
          ['Public scenarios', s.scenarios],
        ].map(([l, v]) => (
          <div key={l as string} className="panel px-4 py-3">
            <dt className="text-[12.5px] text-ink-3">{l}</dt>
            <dd className="tabular mt-1 font-display text-3xl">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Panel>
          <PanelTitle>Games by mode</PanelTitle>
          <ul className="space-y-2 text-sm">
            {s.byMode.map((m) => (
              <li key={m._id} className="flex justify-between border-b border-line/60 pb-2">
                <span className="text-ink-2">{m._id === 'AI' ? 'AI negotiation' : 'Classic'}</span>
                <span className="tabular">{m.n}</span>
              </li>
            ))}
            {s.byMode.length === 0 && <li className="text-ink-3">No games yet.</li>}
          </ul>
        </Panel>
        {can(user.role, 'admin:usage') && (
          <Panel>
            <PanelTitle>AI usage, last 30 days</PanelTitle>
            <p className="text-sm text-ink-2">
              {totals.calls} calls, {totals.failures} failed, {totals.tokens.toLocaleString()} tokens, estimated ${(totals.cost / 1_000_000).toFixed(2)}.
            </p>
            {s.aiUsage.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="text-left text-ink-3">
                    <tr className="border-b border-line">
                      <th className="py-1.5 font-medium">Day</th>
                      <th className="py-1.5 text-right font-medium">Calls</th>
                      <th className="py-1.5 text-right font-medium">Failed</th>
                      <th className="py-1.5 text-right font-medium">Tokens</th>
                      <th className="py-1.5 text-right font-medium">Est. cost</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {s.aiUsage.map((r) => (
                      <tr key={r._id} className="border-b border-line/50">
                        <td className="py-1.5">{r._id}</td>
                        <td className="py-1.5 text-right">{r.calls}</td>
                        <td className="py-1.5 text-right">{r.failures}</td>
                        <td className="py-1.5 text-right">{(r.input + r.output).toLocaleString()}</td>
                        <td className="py-1.5 text-right">${(r.cost / 1_000_000).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[12.5px] text-ink-3">Cost is estimated from provider-reported token counts and a static price table.</p>
          </Panel>
        )}
      </div>
      <p className="text-[12.5px] text-ink-3">Conversation transcripts are private to each user and are not available in the admin area.</p>
    </div>
  )
}
