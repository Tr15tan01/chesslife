import { hash, verify } from '@node-rs/argon2'
import { z } from 'zod'

/** Argon2id (the @node-rs/argon2 default algorithm) with OWASP-recommended parameters. */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS)
}

export async function verifyPassword(stored: string | null, password: string): Promise<boolean> {
  if (!stored) {
    // Spend comparable time to avoid a timing oracle for accounts without a password.
    await hash(password, OPTIONS)
    return false
  }
  try {
    return await verify(stored, password)
  } catch {
    return false
  }
}

const COMMON = new Set(['password', 'password1', 'password123', '12345678', '123456789', 'qwerty123', 'letmein123', 'iloveyou', 'dealcraft', 'negotiate'])

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128, 'Use at most 128 characters.')
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9\W_]/.test(p), 'Mix letters with numbers or symbols.')
  .refine((p) => !COMMON.has(p.toLowerCase()), 'That password is too common.')

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email('Enter a valid email address.')
