'use client'

import { LIFE_AREAS, PIECE_NAMES, type PieceType } from '@/lib/chess/types'
import { squareXY } from '@/lib/chess/pieces'
import { cn } from '@/lib/cn'
import type { BoardProps } from './board-types'

// Filled glyphs for both sides; U+FE0E keeps them as text rather than emoji.
const GLYPH: Record<PieceType, string> = { k: '♚︎', q: '♛︎', r: '♜︎', b: '♝︎', n: '♞︎', p: '♟︎' }
const FILES = 'abcdefgh'

/**
 * Flat board. Squares are buttons (keyboard and screen-reader friendly);
 * pieces are absolutely positioned and slide between squares with a CSS
 * transform transition keyed by their stable identity.
 */
export function Board2D({ pieces, orientation, selected, targets, lastMove, checkSquare, interactive, onSquare }: BoardProps) {
  const flip = orientation === 'b'
  const pos = (sq: string) => {
    const { file, rank } = squareXY(sq)
    const x = flip ? 7 - file : file
    const y = flip ? rank : 7 - rank
    return { x, y }
  }
  const occupant = new Map(pieces.filter((p) => p.square).map((p) => [p.square!, p]))
  const squares: string[] = []
  for (let r = 7; r >= 0; r--) for (let f = 0; f < 8; f++) squares.push(`${FILES[f]}${r + 1}`)

  return (
    <div className="@container relative aspect-square w-full select-none overflow-hidden rounded-[14px] shadow-lg ring-1 ring-gold/40">
      <div className="absolute inset-0 grid grid-cols-8 grid-rows-8" role="grid" aria-label="Chess board">
        {squares
          .map((sq) => ({ sq, ...pos(sq) }))
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map(({ sq, x, y }) => {
            const dark = (squareXY(sq).file + squareXY(sq).rank) % 2 === 0
            const p = occupant.get(sq)
            const isTarget = targets.includes(sq)
            const label = `${sq}${p ? `, ${p.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[p.type]} (${LIFE_AREAS[p.type].area})` : ''}${isTarget ? ', legal move' : ''}`
            return (
              <button
                key={sq}
                type="button"
                role="gridcell"
                aria-label={label}
                aria-selected={selected === sq}
                disabled={!interactive}
                onClick={() => onSquare(sq)}
                className={cn(
                  'relative outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus)] disabled:cursor-default',
                  dark ? 'bg-[#2c3448]' : 'bg-[#d9cfb8]',
                  lastMove && (lastMove.from === sq || lastMove.to === sq) && (dark ? 'bg-[#5a5233]' : 'bg-[#e6d08f]'),
                  selected === sq && 'bg-gold/80',
                )}
                style={{ gridColumn: x + 1, gridRow: y + 1 }}
              >
                {checkSquare === sq && <span className="absolute inset-0 bg-[radial-gradient(circle,rgba(210,80,70,.85)_0%,rgba(210,80,70,.25)_55%,transparent_75%)]" aria-hidden />}
                {isTarget && (
                  <span
                    className={cn('absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full', p ? 'size-[86%] ring-[5px] ring-gold/70' : 'size-[28%] bg-gold/70')}
                    aria-hidden
                  />
                )}
                {x === 0 && <span className={cn('absolute left-1 top-0.5 text-[10px] font-semibold', dark ? 'text-[#d9cfb8]/70' : 'text-[#2c3448]/70')} aria-hidden>{sq[1]}</span>}
                {y === 7 && <span className={cn('absolute bottom-0.5 right-1 text-[10px] font-semibold', dark ? 'text-[#d9cfb8]/70' : 'text-[#2c3448]/70')} aria-hidden>{sq[0]}</span>}
              </button>
            )
          })}
      </div>
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {pieces.map((p) => {
          const { x, y } = pos(p.square ?? p.last)
          const gone = !p.square
          return (
            <span
              key={p.id}
              className={cn(
                'absolute left-0 top-0 grid size-[12.5%] place-items-center leading-none transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(.2,.8,.2,1)]',
                gone && 'opacity-0',
              )}
              style={{ transform: `translate(${x * 100}%, ${y * 100}%) scale(${gone ? 0.3 : 1})` }}
            >
              <span
                className={cn(
                  'text-[10.4cqw] [paint-order:stroke_fill]',
                  p.color === 'w' ? 'text-[#f6efe0] [-webkit-text-stroke:1.5px_#3a3020]' : 'text-[#1a1d24] [-webkit-text-stroke:1.5px_#c9a45c]',
                  selected === p.square && 'drop-shadow-[0_0_10px_rgba(224,189,118,.9)]',
                )}
                style={{ textShadow: '0 3px 6px rgba(0,0,0,.35)' }}
              >
                {GLYPH[p.type]}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
