'use client'

/** Browser-side JSON client for DealCraft Route Handlers. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[] | undefined>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
      headers: opts.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: 'same-origin',
      signal: opts.signal,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and try again.')
  }
  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : {}
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: Record<string, string[]> } }).error
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? 'Something went wrong.', err?.details)
  }
  return data as T
}

export function newKey(): string {
  return crypto.randomUUID().replace(/-/g, '')
}
