import { NextResponse, type NextRequest } from 'next/server'
import { exchangeGoogleCode, OAUTH_COOKIE, readOAuthState } from '@/server/auth/google'
import { getSessionUser, startSession } from '@/server/auth/session'
import { resolveGoogleLogin } from '@/server/services/accounts'
import { appUrl, googleConfig } from '@/server/env'
import { logError } from '@/server/services/logging'

export async function GET(req: NextRequest) {
  const base = appUrl()
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${code}`, base))
    res.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth/google' })
    return res
  }
  if (!googleConfig().enabled) return fail('google-disabled')
  const st = readOAuthState(req.cookies.get(OAUTH_COOKIE)?.value, req.nextUrl.searchParams.get('state'))
  const code = req.nextUrl.searchParams.get('code')
  if (!st || !code) return fail('oauth-state')
  try {
    const profile = await exchangeGoogleCode(code, st)
    const current = st.intent === 'link' ? await getSessionUser() : null
    if (st.intent === 'link' && !current) return fail('oauth-state')
    const result = await resolveGoogleLogin(profile, current?.id ?? null)
    if ('error' in result) {
      if (st.intent === 'link') return NextResponse.redirect(new URL(`/settings?google=${result.error}`, base))
      return fail(result.error)
    }
    if (st.intent === 'login') await startSession(result.user)
    const res = NextResponse.redirect(new URL(st.intent === 'link' ? '/settings?google=linked' : st.next, base))
    res.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth/google' })
    return res
  } catch (err) {
    await logError('oauth', err)
    return fail('oauth-failed')
  }
}
