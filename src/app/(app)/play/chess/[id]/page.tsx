import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ChessClient } from '@/components/chess/chess-client'
import { requireUser } from '@/server/auth/guard'
import { getChessView } from '@/server/services/chess'
import { AppError } from '@/server/http'

export const metadata: Metadata = { title: 'Life Chess' }

export default async function ChessGamePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params
  const view = await getChessView(user, id).catch((e: unknown) => {
    if (e instanceof AppError && e.status === 404) notFound()
    throw e
  })
  return <ChessClient initial={view} />
}
