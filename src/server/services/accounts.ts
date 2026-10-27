import 'server-only'
import { z } from 'zod'
import { getDb } from '../db'
import { isDuplicateKeyError } from '../db/collection'
import type { AuthTokenType, UserDoc } from '../db/models'
import { adminEmails, appUrl } from '../env'
import { randomToken, sha256 } from '../security/crypto'
import { emailSchema, hashPassword, passwordSchema, verifyPassword } from '../security/password'
import { AppError, Errors } from '../http'
import { canSendEmail, sendEmail } from './email'
import { audit } from './logging'

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(128),
})

const GENERIC_LOGIN_ERROR = 'That email and password combination did not work.'

function newUser(input: { email: string; name: string; passwordHash: string | null; emailVerified: Date | null; image?: string | null }): UserDoc {
  const now = new Date()
  return {
    _id: crypto.randomUUID(),
    email: input.email,
    name: input.name,
    passwordHash: input.passwordHash,
    emailVerified: input.emailVerified,
    role: 'USER',
    status: 'ACTIVE',
    plan: 'FREE',
    image: input.image ?? null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    authVersion: 1,
  }
}

/**
 * Bootstrap admins from ADMIN_EMAILS only once the address is verified, so a
 * stranger cannot claim admin by registering an unverified address.
 */
async function applyAdminBootstrap(user: UserDoc): Promise<UserDoc> {
  if (!user.emailVerified || user.role === 'ADMIN') return user
  if (!adminEmails().includes(user.email)) return user
  const db = await getDb()
  await db.users.updateOne({ _id: user._id }, { $set: { role: 'ADMIN', updatedAt: new Date() }, $inc: { authVersion: 1 } })
  await audit(null, 'role.bootstrap', 'user', user._id, { role: 'ADMIN', via: 'ADMIN_EMAILS' })
  return { ...user, role: 'ADMIN', authVersion: user.authVersion + 1 }
}

export async function register(input: z.infer<typeof registerSchema>): Promise<{ user: UserDoc; verificationSent: boolean } | { user: null; verificationSent: boolean }> {
  const db = await getDb()
  const existing = await db.users.findOne({ email: input.email })
  if (existing) {
    // Avoid account enumeration: respond as if it worked, and tell the real owner.
    await sendEmail(input.email, 'Someone tried to register with your email', 'Someone tried to create a DealCraft account with this address. If it was you, sign in or reset your password instead.')
    return { user: null, verificationSent: true }
  }
  const user = newUser({ email: input.email, name: input.name, passwordHash: await hashPassword(input.password), emailVerified: null })
  try {
    await db.users.insertOne(user)
  } catch (err) {
    if (isDuplicateKeyError(err)) return { user: null, verificationSent: true }
    throw err
  }
  await db.preferences.insertOne({ _id: user._id, theme: 'dark', focusSkills: [], defaultMode: 'CLASSIC', timedByDefault: false, showRapport: true, updatedAt: new Date() })
  const verificationSent = await sendVerification(user)
  return { user, verificationSent }
}

export async function authenticate(input: z.infer<typeof loginSchema>): Promise<UserDoc> {
  const db = await getDb()
  const user = await db.users.findOne({ email: input.email })
  const ok = await verifyPassword(user?.passwordHash ?? null, input.password)
  if (!user || !ok) throw new AppError(401, 'BAD_CREDENTIALS', GENERIC_LOGIN_ERROR)
  if (user.status !== 'ACTIVE') throw new AppError(403, 'SUSPENDED', 'This account is suspended. Contact support if you think this is a mistake.')
  return applyAdminBootstrap(user)
}

async function issueToken(userId: string, type: AuthTokenType, ttlMinutes: number) {
  const db = await getDb()
  await db.authTokens.deleteMany({ userId, type })
  const token = randomToken(32)
  await db.authTokens.insertOne({
    _id: crypto.randomUUID(),
    type,
    tokenHash: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
  })
  return token
}

/** Consume a single-use token atomically. */
async function consumeToken(token: string, type: AuthTokenType): Promise<string | null> {
  if (!token || token.length > 100) return null
  const db = await getDb()
  const doc = await db.authTokens.findOneAndUpdate(
    { tokenHash: sha256(token), type, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  )
  return doc?.userId ?? null
}

export async function sendVerification(user: Pick<UserDoc, '_id' | 'email' | 'emailVerified'>): Promise<boolean> {
  if (user.emailVerified || !canSendEmail()) return false
  const token = await issueToken(user._id, 'EMAIL_VERIFY', 24 * 60)
  return sendEmail(user.email, 'Confirm your DealCraft email', `Confirm your email address by opening this link within 24 hours:\n\n${appUrl()}/verify-email?token=${token}\n\nIf you did not create an account, ignore this message.`)
}

export async function verifyEmail(token: string): Promise<UserDoc | null> {
  const userId = await consumeToken(token, 'EMAIL_VERIFY')
  if (!userId) return null
  const db = await getDb()
  await db.users.updateOne({ _id: userId }, { $set: { emailVerified: new Date(), updatedAt: new Date() } })
  const user = await db.users.findOne({ _id: userId })
  return user ? applyAdminBootstrap(user) : null
}

/** Always resolves the same way, whether or not the account exists. */
export async function requestPasswordReset(email: string): Promise<{ emailAvailable: boolean }> {
  if (!canSendEmail()) return { emailAvailable: false }
  const db = await getDb()
  const user = await db.users.findOne({ email })
  if (user && user.status === 'ACTIVE') {
    const token = await issueToken(user._id, 'PASSWORD_RESET', 30)
    await sendEmail(email, 'Reset your DealCraft password', `Reset your password within 30 minutes using this single-use link:\n\n${appUrl()}/reset-password?token=${token}\n\nIf you did not ask for this, you can ignore this email.`)
  }
  return { emailAvailable: true }
}

export async function resetPassword(token: string, password: string): Promise<UserDoc> {
  const parsed = passwordSchema.safeParse(password)
  if (!parsed.success) throw Errors.invalid(parsed.error.issues[0]!.message)
  const userId = await consumeToken(token, 'PASSWORD_RESET')
  if (!userId) throw Errors.invalid('This reset link is invalid or has expired. Request a new one.')
  const db = await getDb()
  await db.users.updateOne(
    { _id: userId },
    // A completed reset also proves control of the inbox.
    { $set: { passwordHash: await hashPassword(password), updatedAt: new Date(), emailVerified: new Date() }, $inc: { authVersion: 1 } },
  )
  await db.sessions.deleteMany({ userId })
  await audit({ id: userId, email: '' }, 'auth.password_reset', 'user', userId)
  const user = await db.users.findOne({ _id: userId })
  return user!
}

export async function changePassword(userId: string, current: string, next: string) {
  const db = await getDb()
  const user = await db.users.findOne({ _id: userId })
  if (!user) throw Errors.unauthenticated()
  if (user.passwordHash && !(await verifyPassword(user.passwordHash, current))) throw Errors.invalid('Your current password is incorrect.')
  const parsed = passwordSchema.safeParse(next)
  if (!parsed.success) throw Errors.invalid(parsed.error.issues[0]!.message)
  await db.users.updateOne({ _id: userId }, { $set: { passwordHash: await hashPassword(next), updatedAt: new Date() }, $inc: { authVersion: 1 } })
  await db.sessions.deleteMany({ userId })
  await audit({ id: userId, email: user.email }, 'auth.password_change', 'user', userId)
  return db.users.findOne({ _id: userId })
}

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; name: string; picture: string | null }

/**
 * Google sign-in resolution:
 *  1. Known Google account → sign in.
 *  2. Linking from settings (signed-in user) → attach to that user.
 *  3. Existing user with the same email → never auto-link; require the
 *     owner to sign in with their password and link from settings.
 *  4. Otherwise create a new verified account (only if Google verified the email).
 */
export async function resolveGoogleLogin(profile: GoogleProfile, linkToUserId: string | null): Promise<{ user: UserDoc } | { error: 'unverified' | 'link-required' | 'already-linked' | 'suspended' }> {
  const db = await getDb()
  if (!profile.emailVerified) return { error: 'unverified' }
  const email = profile.email.toLowerCase()
  const acct = await db.oauthAccounts.findOne({ provider: 'google', providerAccountId: profile.sub })

  if (linkToUserId) {
    if (acct && acct.userId !== linkToUserId) return { error: 'already-linked' }
    if (!acct) {
      await db.oauthAccounts.insertOne({ _id: crypto.randomUUID(), userId: linkToUserId, provider: 'google', providerAccountId: profile.sub, email, createdAt: new Date() })
      await audit({ id: linkToUserId, email }, 'auth.google_linked', 'user', linkToUserId)
    }
    const user = await db.users.findOne({ _id: linkToUserId })
    return user ? { user } : { error: 'link-required' }
  }

  if (acct) {
    const user = await db.users.findOne({ _id: acct.userId })
    if (!user) return { error: 'link-required' }
    if (user.status !== 'ACTIVE') return { error: 'suspended' }
    return { user: await applyAdminBootstrap(user) }
  }

  const existing = await db.users.findOne({ email })
  if (existing) return { error: 'link-required' }

  const user = newUser({ email, name: profile.name.slice(0, 80) || email.split('@')[0]!, passwordHash: null, emailVerified: new Date(), image: profile.picture })
  await db.users.insertOne(user)
  await db.oauthAccounts.insertOne({ _id: crypto.randomUUID(), userId: user._id, provider: 'google', providerAccountId: profile.sub, email, createdAt: new Date() })
  await db.preferences.insertOne({ _id: user._id, theme: 'dark', focusSkills: [], defaultMode: 'CLASSIC', timedByDefault: false, showRapport: true, updatedAt: new Date() })
  return { user: await applyAdminBootstrap(user) }
}

export async function exportUserData(userId: string) {
  const db = await getDb()
  const [user, games, evaluations, progress, preferences, completions, accounts, usage, chessGames] = await Promise.all([
    db.users.findOne({ _id: userId }, { projection: { passwordHash: 0, authVersion: 0 } }),
    db.games.find({ userId }, { sort: { createdAt: -1 }, projection: { processedKeys: 0 } }),
    db.evaluations.find({ userId }),
    db.progress.findOne({ _id: userId }),
    db.preferences.findOne({ _id: userId }),
    db.lessonCompletions.find({ userId }),
    db.oauthAccounts.find({ userId }, { projection: { providerAccountId: 0 } }),
    db.usage.find({ userId }, { limit: 1000, sort: { createdAt: -1 } }),
    db.chessGames.find({ userId }, { sort: { createdAt: -1 }, projection: { processedKeys: 0 } }),
  ])
  return {
    exportedAt: new Date().toISOString(),
    note: 'Personal data export from DealCraft. Hidden scenario configuration is excluded except where revealed in your completed results.',
    user,
    linkedAccounts: accounts,
    preferences,
    progress,
    lessonCompletions: completions,
    games,
    evaluations,
    chessGames,
    aiUsage: usage,
  }
}

export async function deleteAccount(userId: string, confirmation: { password?: string; phrase?: string }) {
  const db = await getDb()
  const user = await db.users.findOne({ _id: userId })
  if (!user) throw Errors.unauthenticated()
  if (user.passwordHash) {
    if (!confirmation.password || !(await verifyPassword(user.passwordHash, confirmation.password))) throw Errors.invalid('Your password is incorrect.')
  } else if (confirmation.phrase !== 'DELETE') {
    throw Errors.invalid('Type DELETE to confirm.')
  }
  const owned = await db.scenarios.find({ ownerId: userId }, { projection: { _id: 1 } })
  if (owned.length) await db.scenarioVersions.deleteMany({ scenarioId: { $in: owned.map((s) => s._id) } })
  await Promise.all([
    db.games.deleteMany({ userId }),
    db.evaluations.deleteMany({ userId }),
    db.chessGames.deleteMany({ userId }),
    db.progress.deleteOne({ _id: userId }),
    db.preferences.deleteOne({ _id: userId }),
    db.lessonCompletions.deleteMany({ userId }),
    db.sessions.deleteMany({ userId }),
    db.authTokens.deleteMany({ userId }),
    db.oauthAccounts.deleteMany({ userId }),
    db.usage.updateMany({ userId }, { $set: { userId: 'deleted' } }),
    db.scenarios.deleteMany({ ownerId: userId }),
  ])
  await db.users.deleteOne({ _id: userId })
  await audit(null, 'account.deleted', 'user', userId, {})
}
