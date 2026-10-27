import 'server-only'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { getDb } from '../db'
import type { Role, UserDoc } from '../db/models'
import { isSecureCookies } from '../env'
import { randomToken, sha256 } from '../security/crypto'

/**
 * Custom session auth. The browser holds an opaque random token in an
 * HttpOnly cookie; only its SHA-256 is stored, so a database leak does not
 * leak usable sessions. Sessions are invalidated whenever the user's
 * `authVersion` changes (password reset, role change, "sign out everywhere").
 */

export const SESSION_COOKIE = 'dc_session'
const SESSION_DAYS = 30
const TOUCH_INTERVAL_MS = 60 * 60 * 1000

export type SessionUser = {
  id: string
  email: string
  name: string
  role: Role
  plan: UserDoc['plan']
  image: string | null
  emailVerified: boolean
  hasPassword: boolean
  sessionId: string
}

export async function createSessionRecord(user: Pick<UserDoc, '_id' | 'authVersion'>, userAgent: string | null) {
  const db = await getDb()
  const token = randomToken(32)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86400 * 1000)
  await db.sessions.insertOne({
    _id: crypto.randomUUID(),
    tokenHash: sha256(token),
    userId: user._id,
    authVersion: user.authVersion,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    userAgent: userAgent?.slice(0, 200) ?? null,
  })
  return { token, expiresAt }
}

export async function resolveSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 100) return null
  const db = await getDb()
  const session = await db.sessions.findOne({ tokenHash: sha256(token) })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await db.sessions.deleteOne({ _id: session._id })
    return null
  }
  const user = await db.users.findOne({ _id: session.userId })
  if (!user || user.status !== 'ACTIVE' || user.authVersion !== session.authVersion) {
    await db.sessions.deleteOne({ _id: session._id })
    return null
  }
  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    // Sliding expiry, written at most hourly.
    await db.sessions.updateOne(
      { _id: session._id },
      { $set: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400 * 1000) } },
    )
  }
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    image: user.image,
    emailVerified: Boolean(user.emailVerified),
    hasPassword: Boolean(user.passwordHash),
    sessionId: session._id,
  }
}

/** Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies()
  return resolveSessionToken(jar.get(SESSION_COOKIE)?.value)
})

export async function startSession(user: Pick<UserDoc, '_id' | 'authVersion'>) {
  const h = await headers()
  const jar = await cookies()
  // Rotate: drop any session the browser already carried.
  const prev = jar.get(SESSION_COOKIE)?.value
  if (prev) await (await getDb()).sessions.deleteOne({ tokenHash: sha256(prev) })
  const { token, expiresAt } = await createSessionRecord(user, h.get('user-agent'))
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecureCookies(),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
  await (await getDb()).users.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } })
}

export async function endSession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await (await getDb()).sessions.deleteOne({ tokenHash: sha256(token) })
  jar.delete(SESSION_COOKIE)
}

/** Invalidate every session for a user (password reset, role change, sign out everywhere). */
export async function revokeAllSessions(userId: string) {
  const db = await getDb()
  await db.users.updateOne({ _id: userId }, { $inc: { authVersion: 1 }, $set: { updatedAt: new Date() } })
  await db.sessions.deleteMany({ userId })
}
