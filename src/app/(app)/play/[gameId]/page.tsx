import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GameClient } from '@/components/play/game-client'
import { requireUser } from '@/server/auth/guard'
import { getGameView } from '@/server/services/games'
import { AppError } from '@/server/http'

export const metadata: Metadata = { title: 'Negotiation' }

export default async function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const user = await requireUser()
  const { gameId } = await params
  const view = await getGameView(user, gameId).catch((e: unknown) => {
    if (e instanceof AppError && e.status === 404) notFound()
    throw e
  })
  return <GameClient initial={view} />
}
