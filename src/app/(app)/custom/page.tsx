import type { Metadata } from 'next'
import { PageHeader } from '@/components/app/app-shell'
import { Panel, PanelTitle } from '@/components/ui/misc'
import { CustomBuilder, DeleteCustom } from '@/components/app/custom-builder'
import { StartButton } from '@/components/play/start-button'
import { requireUser } from '@/server/auth/guard'
import { listCustomScenarios } from '@/server/services/custom'
import { aiAvailable, getFlags } from '@/server/services/flags'

export const metadata: Metadata = { title: 'Custom scenarios' }

export default async function CustomPage() {
  const user = await requireUser()
  const [mine, ai, flags] = await Promise.all([listCustomScenarios(user.id), aiAvailable(), getFlags()])
  return (
    <div className="pb-16">
      <PageHeader title="Rehearse a real negotiation" description="Describe the conversation you have coming up. DealCraft builds a counterpart with hidden limits and priorities at the difficulty you choose. Custom scenarios are private to you." />
      <div className="grid gap-6 px-4 pt-6 sm:px-8 xl:grid-cols-[1.6fr_1fr]">
        <Panel>
          <PanelTitle>New scenario</PanelTitle>
          {flags.customScenarios.enabled ? <CustomBuilder aiAvailable={ai && flags.aiScenarioGeneration.enabled} /> : <p className="text-sm text-ink-2">The custom scenario builder is turned off right now.</p>}
        </Panel>
        <Panel>
          <PanelTitle>Your scenarios</PanelTitle>
          {mine.length === 0 ? (
            <p className="text-sm text-ink-3">Scenarios you create appear here so you can replay them.</p>
          ) : (
            <ul className="divide-y divide-line">
              {mine.map((s) => (
                <li key={s.slug} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{s.title}</p>
                    <p className="truncate text-[12px] text-ink-3">{s.summary}</p>
                  </div>
                  <StartButton size="sm" variant="secondary" input={{ slug: s.slug, mode: 'CLASSIC', variant: 'CUSTOM' }}>
                    Play
                  </StartButton>
                  <DeleteCustom slug={s.slug} title={s.title} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
