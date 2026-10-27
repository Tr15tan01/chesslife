import type { Issue, StatementKind, DialogueKind, Terms, Turn } from '@/lib/negotiation/types'

/**
 * Life Chess domain types. Isomorphic: only shapes that are safe for the
 * browser. Scene outcomes and deal limits stay on the server.
 */

export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type ChessMode = 'CLASSIC' | 'AI'
export type ChessStatus = 'ACTIVE' | 'WON' | 'LOST' | 'DRAWN'
export type EndReason = 'CHECKMATE' | 'RESIGNATION' | 'STALEMATE' | 'REPETITION' | 'INSUFFICIENT' | 'FIFTY_MOVE' | 'AGREEMENT'
export type BotLevel = 1 | 2 | 3

/** Every piece stands for a part of the player's life. */
export const LIFE_AREAS: Record<PieceType, { area: string; meaning: string }> = {
  k: { area: 'You', meaning: 'Your wellbeing. Everything else exists to protect it.' },
  q: { area: 'Career', meaning: 'Your most powerful, most flexible asset.' },
  r: { area: 'Money', meaning: 'Solid and straightforward; strongest with open lines.' },
  b: { area: 'Health', meaning: 'Long-range: its value shows over the whole game.' },
  n: { area: 'Relationships', meaning: 'Moves in unexpected ways and reaches places others cannot.' },
  p: { area: 'Habits', meaning: 'Small steps forward. Enough of them change everything.' },
}

export const PIECE_NAMES: Record<PieceType, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

export const MOMENT_KINDS = [
  'OPENING',
  'DEVELOPMENT',
  'CASTLE',
  'CAPTURE',
  'BIG_CAPTURE',
  'LOSS',
  'BIG_LOSS',
  'TRADE',
  'CHECK_GIVEN',
  'CHECK_RECEIVED',
  'BLUNDER',
  'PROMOTION',
  'ENDGAME',
  'WIN',
  'LOSE',
  'DRAW',
] as const
export type MomentKind = (typeof MOMENT_KINDS)[number]

export type OpponentPublic = {
  key: string
  name: string
  role: string
  bio: string
  level: BotLevel
  levelLabel: string
  tone: 'gold' | 'slate' | 'sage' | 'rose' | 'ink'
}

export type ChessMoveView = {
  ply: number
  color: Color
  san: string
  from: string
  to: string
  piece: PieceType
  captured?: PieceType
  promotion?: PieceType
  /** chess.js flags: n normal, b pawn push, e en passant, c capture, p promotion, k/q castling. */
  flags: string
  check: boolean
  /** Taken back through a negotiated takeback; kept for the record, skipped on the board. */
  undone?: boolean
}

/** A negotiated change to the board: pieces removed before move index `afterMove` is applied. */
export type BoardEdit = { afterMove: number; remove: string[]; reason: DealKind }

export type DealKind = 'TAKEBACK' | 'QUEEN_TRADE' | 'DRAW'
export type DealOutcome = 'AGREED' | 'DECLINED' | 'NO_DEAL'

/** A live negotiation at the board. Hidden limits never leave the server. */
export type DealView = {
  id: string
  kind: DealKind
  by: 'player' | 'opponent'
  title: string
  description: string
  issue: Issue
  counterOffer: Terms | null
  playerOffer: Terms | null
  finalOffer: boolean
  rapport: string
  turns: Turn[]
  discovered: { key: string; text: string }[]
  questions: { key: string; prompt: string; kind: DialogueKind; asked: boolean }[]
  statements: { key: string; text: string; kind: StatementKind; used: boolean }[]
}

export type DealSummary = { id: string; kind: DealKind; by: 'player' | 'opponent'; ply: number; outcome: DealOutcome; terms: string | null; lesson: string }

export type SceneQuality = 'wise' | 'mixed' | 'risky'

export type SceneView = {
  id: string
  ply: number
  kind: MomentKind
  title: string
  setting: string
  body: string
  lesson: string
  options: { key: string; label: string }[]
  chosen: { key: string; outcome: string; quality: SceneQuality } | null
  source: 'rules' | 'ai' | 'mock-ai'
}

export type CommentView = { ply: number; text: string; source: 'rules' | 'ai' | 'mock-ai' }

export type ChessView = {
  id: string
  status: ChessStatus
  endReason: EndReason | null
  mode: ChessMode
  aiAvailable: boolean
  version: number
  opponent: OpponentPublic
  playerColor: Color
  fen: string
  moves: ChessMoveView[]
  comments: CommentView[]
  scenes: SceneView[]
  lifeScore: { wise: number; answered: number; total: number }
  edits: BoardEdit[]
  deal: DealView | null
  deals: DealSummary[]
  /** Deals the player may open right now. */
  can: { takeback: boolean; draw: boolean }
  /** Shown once after a move, e.g. when AI narration fell back to classic text. */
  notice: string | null
  createdAt: string
  completedAt: string | null
}

export type ChessHistoryItem = { id: string; opponent: string; status: ChessStatus; endReason: EndReason | null; moves: number; mode: ChessMode; createdAt: string }
