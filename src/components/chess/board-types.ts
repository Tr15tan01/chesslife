import type { Color } from '@/lib/chess/types'
import type { TrackedPiece } from '@/lib/chess/pieces'

/** Shared contract for the 2D and 3D boards: both are pure views over tracked pieces. */
export type BoardProps = {
  pieces: TrackedPiece[]
  orientation: Color
  selected: string | null
  targets: string[]
  lastMove: { from: string; to: string } | null
  checkSquare: string | null
  interactive: boolean
  onSquare: (square: string) => void
}
