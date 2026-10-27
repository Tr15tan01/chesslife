import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function hmac(secret: string, input: string): string {
  return createHmac('sha256', secret).update(input).digest('base64url')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/** Sign a small JSON payload for a short-lived cookie (OAuth state). */
export function signPayload(secret: string, payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${hmac(secret, body)}`
}

export function verifyPayload<T>(secret: string, token: string | undefined): T | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig || !safeEqual(hmac(secret, body), sig)) return null
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T
  } catch {
    return null
  }
}
