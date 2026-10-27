import type { Metadata } from 'next'
import { PageHeader } from '@/components/app/app-shell'
import { ChessLobby } from '@/components/chess/chess-lobby'
import { requireUser } from '@/server/auth/guard'
import { aiAvailable } from '@/server/services/flags'
import { listRecentChess } from '@/server/services/chess'
import { OPPONENTS } from '@/lib/chess/opponents'

export const metadata: Metadata = { title: 'Life Chess' }

export default async function ChessLobbyPage() {
  const user = await requireUser()
  const [ai, recent] = await Promise.all([aiAvailable(), listRecentChess(user.id)])
  return (
    <div className="pb-16">
      <PageHeader title="Life Chess" description="Real chess against a coach who sees every move as a life decision. Each piece is part of your life, and key moments open real-world scenes." />
      <div className="px-4 pt-6 sm:px-8">
        <ChessLobby opponents={OPPONENTS} aiAvailable={ai} recent={recent} />
      </div>
    </div>
  )
}
