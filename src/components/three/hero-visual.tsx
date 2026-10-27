'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

/** Static illustration used during load, without WebGL, or as an image fallback. */
export function TableFallback({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 420" className={cn('h-full w-full', className)} role="img" aria-label="Illustration of a negotiation table with two stacks of offer tokens">
      <defs>
        <radialGradient id="tf-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#c9a45c" stopOpacity="0.22" />
          <stop offset="1" stopColor="#c9a45c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="300" cy="230" rx="290" ry="170" fill="url(#tf-glow)" />
      <ellipse cx="300" cy="250" rx="250" ry="105" fill="#1c1f27" />
      <ellipse cx="300" cy="244" rx="222" ry="92" fill="#1b2440" stroke="#c9a45c" strokeWidth="3" />
      <line x1="300" y1="156" x2="300" y2="334" stroke="#c9a45c" strokeOpacity=".45" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <ellipse key={`a${i}`} cx="200" cy={252 - i * 9} rx="26" ry="10" fill="#e9e1cf" stroke="#b9b09c" />
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <ellipse key={`b${i}`} cx="400" cy={246 - i * 9} rx="26" ry="10" fill="#c9a45c" stroke="#8c6a2b" />
      ))}
      <rect x="120" y="70" width="80" height="104" rx="4" fill="#e9e1cf" transform="rotate(-12 160 122)" />
      <rect x="250" y="40" width="74" height="96" rx="4" fill="#e9e1cf" opacity=".85" transform="rotate(6 287 88)" />
      <path d="M470 70 l30 34 -30 34 -30 -34z" fill="#d8c08a" opacity=".8" />
    </svg>
  )
}

const TableScene = dynamic(() => import('./table-scene'), { ssr: false, loading: () => <TableFallback /> })

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function HeroVisual({ className }: { className?: string }) {
  const [mode, setMode] = useState<'pending' | '3d' | 'static'>('pending')
  useEffect(() => {
    // Defer the 3D bundle until the browser is idle so text renders first.
    const start = () => setMode(webglAvailable() ? '3d' : 'static')
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(start)
    else setTimeout(start, 150)
  }, [])
  return <div className={cn('relative [mask-image:radial-gradient(75%_70%_at_55%_50%,#000_60%,transparent_100%)]', className)}>{mode === '3d' ? <TableScene className="!absolute inset-0" /> : <TableFallback />}</div>
}
