import { NextResponse, type NextRequest } from 'next/server'
import { buildGoogleAuthorization, OAUTH_COOKIE } from '@/server/auth/google'
import { getSessionUser } from '@/server/auth/session'
import { googleConfig, isSecureCookies, appUrl } from '@/server/env'
import { rateLimit, RULES } from '@/server/security/rate-limit'
import { clientIp } from '@/server/http'

export async function GET(req: NextRequest) {
  const base = appUrl()
  if (!googleConfig().enabled) return NextResponse.redirect(new URL('/login?error=google-disabled', base))
  if (!(await rateLimit(RULES.oauth, clientIp(req))).ok) return NextResponse.redirect(new URL('/login?error=rate-limited', base))
  const intent = req.nextUrl.searchParams.get('intent') === 'link' ? 'link' : 'login'
  if (intent === 'link' && !(await getSessionUser())) return NextResponse.redirect(new URL('/login', base))
  const { url, cookie } = buildGoogleAuthorization(req.nextUrl.searchParams.get('next'), intent)
  const res = NextResponse.redirect(url)
  res.cookies.set(OAUTH_COOKIE, cookie, { httpOnly: true, secure: isSecureCookies(), sameSite: 'lax', path: '/api/auth/google', maxAge: 600 })
  return res
}
