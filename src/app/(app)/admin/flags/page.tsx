import type { Metadata } from 'next'
import { Panel } from '@/components/ui/misc'
import { FlagRow } from '@/components/app/admin-controls'
import { requirePermission } from '@/server/auth/guard'
import { FLAG_DEFS, getFlags, type FlagKey } from '@/server/services/flags'
import { aiConfigured } from '@/server/ai/providers'

export const metadata: Metadata = { title: 'Features' }

export default async function FlagsPage() {
  await requirePermission('admin:flags')
  const flags = await getFlags()
  return (
    <Panel className="max-w-3xl">
      <p className="mb-2 text-sm text-ink-2">
        Server environment: AI is <strong className="text-ink">{aiConfigured() ? 'configured' : 'not configured'}</strong>. Flags can switch features off; they cannot enable AI without server configuration. Billing is not enabled in this release.
      </p>
      <div className="divide-y divide-line">
        {(Object.keys(FLAG_DEFS) as FlagKey[]).map((k) => (
          <FlagRow key={k} k={k} label={FLAG_DEFS[k].label} enabled={flags[k].enabled} value={'value' in FLAG_DEFS[k] ? flags[k].value : undefined} />
        ))}
      </div>
    </Panel>
  )
}
