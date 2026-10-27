import { NextResponse, type NextRequest } from 'next/server'

/**
 * Runs before every page request:
 *  - issues a per-request CSP nonce (Next.js applies it to its own scripts)
 *  - optimistic redirect to /login when there is no session cookie on an
 *    app route. Real authorisation happens server-side in each layout/page
 *    and in every Route Handler; this is only a fast path.
 */
const PROTECTED = ['/dashboard', '/play', '/results', '/training', '/progress', '/history', '/profile', '/settings', '/admin', '/challenges', '/custom']

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !req.cookies.has('dc_session')) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?next=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(url)
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const dev = process.env.NODE_ENV === 'development'
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Inline style attributes are used by animation and chart libraries.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://lh3.googleusercontent.com`,
    `font-src 'self' data:`,
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    `worker-src 'self' blob:`,
    `frame-ancestors 'none'`,
    `form-action 'self' https://accounts.google.com`,
    `base-uri 'self'`,
    `object-src 'none'`,
    ...(process.env.AUTH_URL?.startsWith('https://') ? ['upgrade-insecure-requests'] : []),
  ].join('; ')

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('x-pathname', pathname + search)
  requestHeaders.set('Content-Security-Policy', csp)
  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('Content-Security-Policy', csp)
  return res
}

export const config = {
  matcher: [{ source: '/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }] }],
}
