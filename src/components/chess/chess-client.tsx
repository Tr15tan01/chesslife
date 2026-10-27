'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Chess, type Square } from 'chess.js'
import { ArrowLeftRight, Box, Flag, Grid3x3, Handshake, RotateCcw, Scale, Sparkles, Undo2 } from 'lucide-react'
import { LIFE_AREAS, PIECE_NAMES, type ChessMoveView, type ChessView, type DealKind, type PieceType } from '@/lib/chess/types'
import { STARTING_COUNT, trackPieces } from '@/lib/chess/pieces'
import { api, ApiError, newKey } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Badge, Meter, Panel, PanelTitle } from '@/components/ui/misc'
import { Dialog, DialogClose } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Avatar } from '@/components/marketing/avatar'
import { cn } from '@/lib/cn'
import { Board2D } from './board-2d'
import { KIND_META, QUALITY_META, SceneCard } from './scene-card'
import { DealPanel, type DealAction } from './deal-panel'

const Board3D = dynamic(() => import('./board-3d'), { ssr: false, loading: () => <div className="size-full animate-pulse rounded-[14px] bg-surface-2" aria-hidden /> })

const BOARD_PREF = 'dc-chess-board'
const REVEAL_MS = 420
const AREA_ORDER: PieceType[] = ['q', 'r', 'b', 'n', 'p']
const END_TEXT: Record<NonNullable<ChessView['endReason']>, string> = {
  CHECKMATE: 'by checkmate',
  RESIGNATION: 'by resignation',
  STALEMATE: 'by stalemate',
  REPETITION: 'by threefold repetition',
  INSUFFICIENT: 'by insufficient material',
  FIFTY_MOVE: 'by the fifty-move rule',
  AGREEMENT: 'by agreement',
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

type BoardEnv = { webgl: boolean; pref: string | null; reduced: boolean }
let boardEnv: BoardEnv | null = null
/** Read once per page load; a stable snapshot for useSyncExternalStore. */
function readBoardEnv(): BoardEnv {
  if (!boardEnv) {
    let pref: string | null = null
    try {
      pref = localStorage.getItem(BOARD_PREF)
    } catch {
      /* storage unavailable */
    }
    boardEnv = { webgl: webglAvailable(), pref, reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches }
  }
  return boardEnv
}
const noSubscribe = () => () => {}

const DEAL_LABEL: Record<DealKind, string> = { TAKEBACK: 'Takeback', QUEEN_TRADE: 'Queen trade', DRAW: 'Draw offer' }

function DealIcon({ kind }: { kind: DealKind }) {
  const Icon = kind === 'TAKEBACK' ? Handshake : kind === 'QUEEN_TRADE' ? ArrowLeftRight : Scale
  return <Icon className="size-4 shrink-0 text-gold" aria-hidden />
}

export function ChessClient({ initial }: { initial: ChessView }) {
  const router = useRouter()
  const toast = useToast()
  const [view, setView] = useState(initial)
  const [pending, setPending] = useState<ChessMoveView | null>(null)
  const [shown, setShown] = useState(initial.moves.length)
  const [selected, setSelected] = useState<string | null>(null)
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [sceneId, setSceneId] = useState<string | null>(null)
  const [pickedBoard, setPickedBoard] = useState<'3d' | '2d' | null>(null)
  const env = useSyncExternalStore(noSubscribe, readBoardEnv, () => null)
  const webgl = env?.webgl ?? true
  const boardMode = !env ? null : (pickedBoard ?? (env.webgl && (env.pref === '3d' || (env.pref !== '2d' && !env.reduced)) ? '3d' : '2d'))
  // Scenes already shown; an unanswered scene from before a reload opens again.
  const seen = useRef(new Set(initial.scenes.filter((s) => s.chosen).map((s) => s.id)))

  const chooseBoard = (m: '3d' | '2d') => {
    setPickedBoard(m)
    try {
      localStorage.setItem(BOARD_PREF, m)
    } catch {
      /* storage unavailable */
    }
  }

  const all = useMemo(() => (pending ? [...view.moves, pending] : view.moves), [view.moves, pending])

  // Reveal moves one at a time so the bot's reply animates after the player's move lands.
  const visible = Math.min(shown, all.length)
  useEffect(() => {
    if (visible >= all.length) return
    const t = setTimeout(() => setShown(visible + 1), REVEAL_MS)
    return () => clearTimeout(t)
  }, [visible, all.length])

  const displayed = useMemo(() => all.slice(0, visible), [all, visible])
  const pieces = useMemo(() => trackPieces(displayed, view.edits), [displayed, view.edits])
  const settled = !pending && visible === view.moves.length
  const chess = useMemo(() => new Chess(view.fen), [view.fen])
  const ended = view.status !== 'ACTIVE'
  const myTurn = !ended && settled && !busy && !view.deal && chess.turn() === view.playerColor
  const legal = useMemo(() => (myTurn ? chess.moves({ verbose: true }) : []), [chess, myTurn])
  const targets: string[] = selected ? legal.filter((m) => m.from === selected).map((m) => m.to) : []
  const last = displayed.filter((m) => !m.undone).at(-1)
  const checkSquare = useMemo(() => {
    if (!settled || !chess.inCheck()) return null
    for (const row of chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === chess.turn()) return p.square
    return null
  }, [chess, settled])

  // Open the newest unseen scene once the board has caught up.
  useEffect(() => {
    if (!settled) return
    const next = [...view.scenes].reverse().find((s) => !seen.current.has(s.id))
    if (!next) return
    seen.current.add(next.id)
    const t = setTimeout(() => setSceneId(next.id), 350)
    return () => clearTimeout(t)
  }, [settled, view.scenes])

  const refresh = useCallback(async () => {
    try {
      const v = await api<ChessView>(`/api/chess/${view.id}`)
      setView(v)
      setShown(v.moves.length)
    } catch {
      /* ignore */
    }
  }, [view.id])

  const act = useCallback(
    async (action: Record<string, unknown>) => {
      const v = await api<ChessView>(`/api/chess/${view.id}/actions`, { body: { action, idempotencyKey: newKey(), expectedVersion: view.version } })
      setView(v)
      if (v.notice) toast(v.notice, 'info')
      return v
    },
    [view.id, view.version, toast],
  )

  const fail = (e: unknown) => {
    toast(e instanceof Error ? e.message : 'Something went wrong.', 'bad')
    if (e instanceof ApiError && e.status === 409) void refresh()
  }

  const send = async (from: string, to: string, promotion?: string) => {
    const local = new Chess(view.fen)
    let m
    try {
      m = local.move({ from, to, promotion })
    } catch {
      return
    }
    setPending({ ply: view.moves.length, color: m.color, san: m.san, from, to, piece: m.piece, captured: m.captured, promotion: m.promotion, flags: m.flags, check: /[+#]$/.test(m.san) })
    setShown(view.moves.length + 1)
    setSelected(null)
    setBusy(true)
    try {
      await act({ type: 'MOVE', from, to, ...(promotion ? { promotion } : {}) })
    } catch (e) {
      setShown(view.moves.length)
      fail(e)
    } finally {
      setPending(null)
      setBusy(false)
    }
  }

  const onSquare = (sq: string) => {
    if (!myTurn) return
    if (selected && targets.includes(sq)) {
      const cands = legal.filter((m) => m.from === selected && m.to === sq)
      if (cands.some((m) => m.promotion)) setPromo({ from: selected, to: sq })
      else void send(selected, sq)
      return
    }
    const p = chess.get(sq as Square)
    setSelected(p && p.color === view.playerColor && sq !== selected ? sq : null)
  }

  const choose = async (id: string, optionKey: string) => {
    try {
      await act({ type: 'CHOOSE', sceneId: id, optionKey })
    } catch (e) {
      fail(e)
    }
  }

  const dealAct = async (action: DealAction) => {
    setBusy(true)
    try {
      await act({ type: 'DEAL', action })
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const requestDeal = async (kind: 'TAKEBACK' | 'DRAW') => {
    setBusy(true)
    try {
      await act({ type: 'DEAL_REQUEST', kind })
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const resign = async () => {
    setBusy(true)
    try {
      await act({ type: 'RESIGN' })
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const toggleMode = async () => {
    const mode = view.mode === 'AI' ? 'CLASSIC' : 'AI'
    try {
      setView(await api<ChessView>(`/api/chess/${view.id}/mode`, { body: { mode } }))
      toast(mode === 'AI' ? 'AI narration on. Your opponent now talks in their own words.' : 'Classic mode on. Commentary follows the written scenes.', 'ok')
    } catch (e) {
      fail(e)
    }
  }

  const rematch = async () => {
    setBusy(true)
    try {
      const r = await api<{ id: string }>('/api/chess', { body: { opponent: view.opponent.key, mode: view.mode === 'AI' && view.aiAvailable ? 'AI' : 'CLASSIC', color: view.playerColor } })
      router.push(`/play/chess/${r.id}`)
    } catch (e) {
      fail(e)
      setBusy(false)
    }
  }

  const op = view.opponent
  const comment = settled ? view.comments.at(-1) : undefined
  const scene = view.scenes.find((s) => s.id === sceneId) ?? null
  const mine = pieces.filter((p) => p.color === view.playerColor && p.square)
  const count = (t: PieceType) => mine.filter((p) => p.type === t).length
  const boardProps = { pieces, orientation: view.playerColor, selected, targets, lastMove: last ? { from: last.from, to: last.to } : null, checkSquare, interactive: myTurn, onSquare }
  const resultTitle = view.status === 'WON' ? 'You won' : view.status === 'LOST' ? 'You lost' : 'Draw'
  const pairs: [ChessMoveView | undefined, ChessMoveView | undefined][] = []
  const startsBlack = view.moves[0]?.color === 'b'
  const list = startsBlack ? [undefined, ...view.moves] : view.moves
  for (let i = 0; i < list.length; i += 2) pairs.push([list[i], list[i + 1]])

  return (
    <div className="grid gap-6 px-4 pb-16 pt-6 sm:px-8 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={op.name} tone={op.tone} />
            <div>
              <p className="font-display text-xl leading-tight">{op.name}</p>
              <p className="text-[13px] text-ink-3">
                {op.role} · <span className="text-ink-2">{op.levelLabel}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className={cn('inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1.5 text-[13px]', !view.aiAvailable && 'opacity-60')} title={view.aiAvailable ? undefined : 'AI is not configured on this server'}>
              <Sparkles className="size-3.5 text-gold" aria-hidden />
              AI narration
              <input type="checkbox" role="switch" className="size-4 accent-[var(--gold)]" checked={view.mode === 'AI'} disabled={!view.aiAvailable || ended} onChange={() => void toggleMode()} aria-label="AI narration" />
            </label>
            <div role="radiogroup" aria-label="Board view" className="inline-flex rounded-full border border-line-strong p-0.5">
              {(
                [
                  ['3d', '3D', Box],
                  ['2d', '2D', Grid3x3],
                ] as const
              ).map(([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={boardMode === m}
                  disabled={m === '3d' && !webgl}
                  onClick={() => chooseBoard(m)}
                  className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] transition-colors disabled:opacity-40', boardMode === m ? 'bg-gold text-gold-ink' : 'text-ink-2 hover:text-ink')}
                >
                  <Icon className="size-3.5" aria-hidden /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={cn('relative mx-auto w-full', boardMode === '3d' ? 'aspect-square sm:aspect-[5/4] sm:max-w-[min(100%,calc((100dvh-11rem)*1.25))]' : 'aspect-square max-w-[min(100%,calc(100dvh-11rem))]')}>
          {boardMode === '3d' ? (
            <div className="absolute inset-0 overflow-hidden rounded-[16px] bg-[radial-gradient(80%_70%_at_50%_35%,#1d2335_0%,#0d1016_100%)] ring-1 ring-line">
              <Board3D {...boardProps} className="!absolute inset-0" />
            </div>
          ) : boardMode === '2d' ? (
            <Board2D {...boardProps} />
          ) : (
            <div className="size-full animate-pulse rounded-[14px] bg-surface-2" aria-hidden />
          )}
          {boardMode === '3d' && <p className="pointer-events-none absolute bottom-2 left-3 text-[11.5px] text-ink-3">Drag to orbit · scroll to zoom</p>}
        </div>

        <div className="flex min-h-[4.5rem] items-start gap-3" aria-live="polite">
          <Avatar name={op.name} tone={op.tone} size="sm" className="mt-1" />
          <div className="rounded-[16px] rounded-tl-[6px] bg-surface-2 px-4 py-2.5 text-[15px] leading-relaxed ring-1 ring-line">
            {busy && !settled ? (
              <span className="typing inline-flex gap-1 py-1.5" aria-label={`${op.name} is thinking`}>
                <span className="size-1.5 rounded-full bg-ink-3" />
                <span className="size-1.5 rounded-full bg-ink-3" />
                <span className="size-1.5 rounded-full bg-ink-3" />
              </span>
            ) : comment ? (
              <>
                {comment.text}
                {(comment.source === 'ai' || comment.source === 'mock-ai') && (
                  <span className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-3">
                    <Sparkles className="size-3" aria-hidden /> {comment.source === 'mock-ai' ? 'Simulated AI reply (mock provider)' : 'AI-written reply'}
                  </span>
                )}
              </>
            ) : (
              <span className="text-ink-2">{myTurn ? 'Your move. Every piece is part of your life: play it like it matters.' : 'Waiting…'}</span>
            )}
          </div>
        </div>

        {view.deal && settled && <DealPanel key={view.deal.id} deal={view.deal} opponent={op} ai={view.mode === 'AI'} busy={busy} onAct={dealAct} />}

        {ended && settled && (
          <Panel className="animate-rise">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-display text-3xl">{resultTitle}</p>
                <p className="text-[14px] text-ink-2">
                  {view.endReason ? END_TEXT[view.endReason] : ''} · {Math.ceil(view.moves.length / 2)} moves · {view.lifeScore.wise} of {view.lifeScore.total} life choices were wise
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void rematch()} loading={busy}>
                  <RotateCcw className="size-4" aria-hidden /> Rematch
                </Button>
                <Button variant="secondary" asChild>
                  <Link href="/play/chess">Choose opponent</Link>
                </Button>
              </div>
            </div>
          </Panel>
        )}
      </div>

      <aside className="space-y-4">
        <Panel>
          <PanelTitle action={<Badge tone={view.status === 'ACTIVE' ? (myTurn ? 'gold' : 'neutral') : view.status === 'WON' ? 'ok' : view.status === 'LOST' ? 'bad' : 'blue'}>{view.status === 'ACTIVE' ? (myTurn ? 'Your move' : 'Their move') : resultTitle}</Badge>}>Life balance</PanelTitle>
          <ul className="space-y-3">
            <li className="flex items-center justify-between text-[14px]">
              <span>
                <span className="font-medium">You</span> <span className="text-ink-3">· wellbeing (king)</span>
              </span>
              <span className={cn('text-[13px]', checkSquare && chess.turn() === view.playerColor ? 'text-bad' : view.status === 'LOST' && view.endReason === 'CHECKMATE' ? 'text-bad' : 'text-ok')}>
                {view.status === 'LOST' && view.endReason === 'CHECKMATE' ? 'Checkmated' : checkSquare && chess.turn() === view.playerColor ? 'Under pressure' : 'Safe'}
              </span>
            </li>
            {AREA_ORDER.map((t) => (
              <li key={t} title={LIFE_AREAS[t].meaning}>
                <div className="mb-1 flex items-center justify-between text-[13.5px]">
                  <span>
                    {LIFE_AREAS[t].area} <span className="text-ink-3">· {PIECE_NAMES[t]}s</span>
                  </span>
                  <span className="tabular text-ink-2">
                    {count(t)}/{STARTING_COUNT[t]}
                  </span>
                </div>
                <Meter value={Math.min(100, (count(t) / STARTING_COUNT[t]) * 100)} label={`${LIFE_AREAS[t].area} remaining`} tone={count(t) / STARTING_COUNT[t] >= 0.5 ? 'gold' : 'bad'} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelTitle action={<span className="tabular text-[13px] text-ink-3">{view.lifeScore.wise} wise · {view.lifeScore.answered}/{view.lifeScore.total}</span>}>Life scenes</PanelTitle>
          {view.scenes.length ? (
            <ol className="space-y-1.5">
              {view.scenes.map((s) => {
                const M = KIND_META[s.kind]
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => setSceneId(s.id)} className="flex w-full items-center gap-3 rounded-[10px] px-2 py-1.5 text-left text-[14px] hover:bg-surface-2">
                      <M.icon className="size-4 shrink-0 text-gold" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{s.title}</span>
                      {s.chosen ? <Badge tone={QUALITY_META[s.chosen.quality].tone}>{QUALITY_META[s.chosen.quality].label.split(' ')[0]}</Badge> : <Badge tone="gold">Open</Badge>}
                    </button>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="text-[14px] text-ink-2">Key moments in the game, like your first move, castling, a big capture or a check, open a short real-life scene.</p>
          )}
        </Panel>

        <Panel>
          <PanelTitle>Deals</PanelTitle>
          {!ended && (
            <div className="mb-3 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={!view.can.takeback || busy || !settled} onClick={() => void requestDeal('TAKEBACK')} title="Right after your opponent replies, ask to take your last move back. They will want something for it.">
                <Undo2 className="size-3.5" aria-hidden /> Ask for a takeback
              </Button>
              <Button variant="secondary" size="sm" disabled={!view.can.draw || busy || !settled} onClick={() => void requestDeal('DRAW')} title="From move 10, on your move. Your opponent accepts only if they do not think they are winning.">
                <Scale className="size-3.5" aria-hidden /> Offer a draw
              </Button>
            </div>
          )}
          {view.deals.length ? (
            <ol className="space-y-2">
              {view.deals.map((d) => (
                <li key={d.id}>
                  <details className="group rounded-[10px] px-2 py-1.5 hover:bg-surface-2">
                    <summary className="flex cursor-pointer list-none items-center gap-2.5 text-[14px]">
                      <DealIcon kind={d.kind} />
                      <span className="min-w-0 flex-1 truncate">
                        {DEAL_LABEL[d.kind]}
                        {d.terms && <span className="text-ink-3"> · {d.terms}</span>}
                      </span>
                      <Badge tone={d.outcome === 'AGREED' ? 'ok' : d.outcome === 'DECLINED' ? 'neutral' : 'bad'}>{d.outcome === 'AGREED' ? 'Agreed' : d.outcome === 'DECLINED' ? 'Declined' : 'No deal'}</Badge>
                    </summary>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{d.lesson}</p>
                  </details>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[14px] text-ink-2">Takebacks, queen trades and draws are negotiated. Your opponent may also put a deal on the table.</p>
          )}
        </Panel>

        <Panel>
          <PanelTitle>Moves</PanelTitle>
          {pairs.length ? (
            <ol className="tabular grid max-h-56 grid-cols-[2.2rem_1fr_1fr] gap-x-2 gap-y-0.5 overflow-y-auto text-[14px]">
              {pairs.map(([w, b], i) => (
                <li key={i} className="contents">
                  <span className="text-ink-3">{i + 1}.</span>
                  <span className={cn(w && w.ply === last?.ply && 'text-gold', w?.undone && 'text-ink-3 line-through')} title={w?.undone ? 'Taken back' : undefined}>
                    {w?.san ?? '…'}
                  </span>
                  <span className={cn(b && b.ply === last?.ply && 'text-gold', b?.undone && 'text-ink-3 line-through')} title={b?.undone ? 'Taken back' : undefined}>
                    {b?.san ?? ''}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[14px] text-ink-2">No moves yet.</p>
          )}
          {!ended && (
            <Dialog
              title="Resign this game?"
              description="Resigning ends the game as a loss. Sometimes knowing when to stop is the wise move."
              trigger={
                <Button variant="ghost" size="sm" className="mt-4" disabled={busy}>
                  <Flag className="size-3.5" aria-hidden /> Resign
                </Button>
              }
            >
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="secondary">Keep playing</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="danger" onClick={() => void resign()}>
                    Resign
                  </Button>
                </DialogClose>
              </div>
            </Dialog>
          )}
        </Panel>
      </aside>

      <Dialog open={promo !== null} onOpenChange={(o) => !o && setPromo(null)} title="Promote your pawn" description="A habit that walked the whole board. What should it become?">
        <div className="grid grid-cols-2 gap-2">
          {(['q', 'r', 'b', 'n'] as const).map((t) => (
            <Button
              key={t}
              variant={t === 'q' ? 'primary' : 'secondary'}
              onClick={() => {
                const p = promo!
                setPromo(null)
                void send(p.from, p.to, t)
              }}
            >
              {PIECE_NAMES[t][0]!.toUpperCase() + PIECE_NAMES[t].slice(1)} · {LIFE_AREAS[t].area}
            </Button>
          ))}
        </div>
      </Dialog>

      <SceneCard scene={scene} open={scene !== null} onOpenChange={(o) => !o && setSceneId(null)} onChoose={choose} />
    </div>
  )
}
