'use client'

import { useSyncExternalStore } from 'react'

/** Matches a media query; renders the desktop layout on the server. */
export function useMediaQuery(query: string, serverValue = true): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  )
}
