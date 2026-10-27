import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { z, type ZodType } from 'zod'
import { getSessionUser, type SessionUser } from './auth/session'
import { can, type Permission } from './auth/permissions'
import { appUrl, ConfigError } from './env'
import { RateLimitedError } from './security/rate-limit'
import { logError } from './services/logging'

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const Errors = {
  unauthenticated: () => new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.'),
  forbidden: () => new AppError(403, 'FORBIDDEN', 'You do not have access to this.'),
  notFound: (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found.`),
  conflict: (msg: string) => new AppError(409, 'CONFLICT', msg),
  invalid: (msg: string, details?: unknown) => new AppError(400, 'INVALID', msg, details),
  unavailable: (msg: string) => new AppError(503, 'UNAVAILABLE', msg),
}

const MAX_BODY_BYTES = 32 * 1024

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  return (fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local').slice(0, 64)
}

/**
 * CSRF defence for cookie-authenticated mutations: the Origin (or Referer)
 * must match this deployment. Combined with SameSite=Lax session cookies.
 */
export function assertSameOrigin(req: NextRequest) {
  const allowed = new Set([new URL(appUrl()).origin, req.nextUrl.origin])
  const origin = req.headers.get('origin')
  if (origin) {
    if (!allowed.has(origin)) throw new AppError(403, 'BAD_ORIGIN', 'Cross-site request rejected.')
    return
  }
  const referer = req.headers.get('referer')
  if (referer) {
    try {
      if (allowed.has(new URL(referer).origin)) return
    } catch {
      /* fall through */
    }
  }
  throw new AppError(403, 'BAD_ORIGIN', 'Cross-site request rejected.')
}

export async function readJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  const len = Number(req.headers.get('content-length') ?? '0')
  if (len > MAX_BODY_BYTES) throw new AppError(413, 'TOO_LARGE', 'Request body is too large.')
  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) throw new AppError(413, 'TOO_LARGE', 'Request body is too large.')
  let data: unknown
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw Errors.invalid('Body must be valid JSON.')
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw Errors.invalid(parsed.error.issues[0]?.message ?? 'Invalid request.', z.flattenError(parsed.error).fieldErrors)
  }
  return parsed.data
}

type Ctx<P> = { req: NextRequest; params: P; user: SessionUser | null; ip: string }

type Opts = { auth?: boolean; permission?: Permission; csrf?: boolean }

/**
 * Wraps a Route Handler with: same-origin checks for mutations, session
 * resolution, authorisation, and safe error mapping. Internal errors are
 * logged server-side; the client only sees a generic message.
 */
export function route<P = Record<string, string>>(opts: Opts, handler: (ctx: Ctx<P>) => Promise<unknown>) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
      if (isMutation && opts.csrf !== false) assertSameOrigin(req)
      const user = await getSessionUser()
      if ((opts.auth || opts.permission) && !user) throw Errors.unauthenticated()
      if (opts.permission && !can(user!.role, opts.permission)) throw Errors.forbidden()
      const params = (await context.params) ?? ({} as P)
      const result = await handler({ req, params, user, ip: clientIp(req) })
      if (result instanceof Response) return result
      return NextResponse.json(result ?? { ok: true }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (err) {
      return errorResponse(err, req)
    }
  }
}

export async function errorResponse(err: unknown, req?: NextRequest) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status })
  }
  if (err instanceof RateLimitedError) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' } },
      { status: 429, headers: { 'Retry-After': String(err.retryAfterSec) } },
    )
  }
  if (err instanceof ConfigError) {
    console.error('[config]', err.message)
    return NextResponse.json({ error: { code: 'CONFIG', message: 'This feature is not configured on the server.' } }, { status: 503 })
  }
  await logError('api', err, req?.nextUrl.pathname)
  return NextResponse.json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } }, { status: 500 })
}
