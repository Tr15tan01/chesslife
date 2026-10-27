import 'server-only'
import { createHash } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { appUrl, authSecret, googleConfig, ConfigError } from '../env'
import { randomToken, signPayload, verifyPayload } from '../security/crypto'
import { safeRedirect } from '../security/redirect'
import type { GoogleProfile } from '../services/accounts'

/**
 * Google OAuth 2.0 / OpenID Connect with PKCE, state and nonce.
 * State, nonce, verifier, intent and return path live in a short-lived,
 * HMAC-signed, HttpOnly cookie, so the callback can verify all of them.
 */

export const OAUTH_COOKIE = 'dc_oauth'
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

export type OAuthState = { state: string; nonce: string; verifier: string; next: string; intent: 'login' | 'link'; exp: number }

export function redirectUri(): string {
  return `${appUrl()}/api/auth/google/callback`
}

export function requireGoogle() {
  const cfg = googleConfig()
  if (!cfg.enabled) throw new ConfigError('Google sign-in is disabled.')
  return cfg
}

export function buildGoogleAuthorization(next: unknown, intent: 'login' | 'link') {
  const cfg = requireGoogle()
  const verifier = randomToken(48)
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const st: OAuthState = {
    state: randomToken(24),
    nonce: randomToken(24),
    verifier,
    next: safeRedirect(next, intent === 'link' ? '/settings' : '/dashboard'),
    intent,
    exp: Date.now() + 10 * 60 * 1000,
  }
  const url = new URL(AUTH_ENDPOINT)
  url.searchParams.set('client_id', cfg.clientId)
  url.searchParams.set('redirect_uri', redirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', st.state)
  url.searchParams.set('nonce', st.nonce)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('prompt', 'select_account')
  return { url: url.toString(), cookie: signPayload(authSecret(), st) }
}

export function readOAuthState(cookieValue: string | undefined, returnedState: string | null): OAuthState | null {
  const st = verifyPayload<OAuthState>(authSecret(), cookieValue)
  if (!st || !returnedState || st.state !== returnedState || st.exp < Date.now()) return null
  return st
}

export async function exchangeGoogleCode(code: string, st: OAuthState): Promise<GoogleProfile> {
  const cfg = requireGoogle()
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
      code_verifier: st.verifier,
    }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`)
  const body = (await res.json()) as { id_token?: string }
  if (!body.id_token) throw new Error('Google response did not include an id_token')
  const { payload } = await jwtVerify(body.id_token, JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: cfg.clientId,
  })
  if (payload.nonce !== st.nonce) throw new Error('OIDC nonce mismatch')
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') throw new Error('OIDC token missing claims')
  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : '',
    picture: typeof payload.picture === 'string' && payload.picture.startsWith('https://') ? payload.picture : null,
  }
}
