'use client'

import { useSyncExternalStore } from 'react'

/**
 * Tiny shared store so the live preview can move the chips on the 3D table.
 * `gap` is 0..1 — how far apart the two offers are (1 = far, 0 = deal).
 * `pulse` increments whenever a new move happens.
 */
type TableState = { gap: number; pulse: number; mood: 'neutral' | 'warm' | 'cool' }
let state: TableState = { gap: 0.85, pulse: 0, mood: 'neutral' }
const subs = new Set<() => void>()

export const tableStore = {
  get: () => state,
  set(patch: Partial<TableState>) {
    state = { ...state, ...patch, pulse: state.pulse + 1 }
    subs.forEach((f) => f())
  },
  subscribe(f: () => void) {
    subs.add(f)
    return () => subs.delete(f)
  },
}

export function useTableState() {
  return useSyncExternalStore(tableStore.subscribe, tableStore.get, tableStore.get)
}
