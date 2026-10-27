import { describe, expect, it } from 'vitest'
import { safeRedirect } from '@/server/security/redirect'
import { can } from '@/server/auth/permissions'
import { passwordSchema } from '@/server/security/password'
import { signPayload, verifyPayload } from '@/server/security/crypto'
import { checkQuota } from '@/server/services/usage'
import { nextStreak } from '@/server/services/completion'

describe('safe redirects', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/play/abc?x=1', '/play/abc?x=1'],
    ['https://evil.example', '/dashboard'],
    ['//evil.example', '/dashboard'],
    ['/\\evil.example', '/dashboard'],
    ['javascript:alert(1)', '/dashboard'],
    ['/api/auth/logout', '/dashboard'],
    [undefined, '/dashboard'],
  ])('%s → %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected)
  })
})

describe('permissions', () => {
  it('users cannot reach admin capabilities', () => {
    expect(can('USER', 'admin:view')).toBe(false)
    expect(can('USER', 'content:manage')).toBe(false)
  })
  it('content managers manage content but not accounts', () => {
    expect(can('CONTENT_MANAGER', 'content:manage')).toBe(true)
    expect(can('CONTENT_MANAGER', 'admin:users')).toBe(false)
    expect(can('CONTENT_MANAGER', 'admin:roles')).toBe(false)
  })
  it('admins can do everything', () => {
    expect(can('ADMIN', 'admin:roles')).toBe(true)
    expect(can(null, 'admin:view')).toBe(false)
  })
})

describe('password policy', () => {
  it('requires length and variety and blocks common passwords', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false)
    expect(passwordSchema.safeParse('onlyletterslong').success).toBe(false)
    expect(passwordSchema.safeParse('password123').success).toBe(false)
    expect(passwordSchema.safeParse('Negotiate-2026!').success).toBe(true)
  })
})

describe('signed payloads', () => {
  it('detects tampering', () => {
    const secret = 'x'.repeat(40)
    const token = signPayload(secret, { state: 'abc' })
    expect(verifyPayload<{ state: string }>(secret, token)?.state).toBe('abc')
    const [body] = token.split('.')
    expect(verifyPayload(secret, `${body}.forged`)).toBeNull()
    expect(verifyPayload('y'.repeat(40), token)).toBeNull()
  })
})

describe('usage limits and streaks', () => {
  it('enforces quotas', () => {
    expect(checkQuota(39, 40).ok).toBe(true)
    expect(checkQuota(40, 40).ok).toBe(false)
  })
  it('counts consecutive days only', () => {
    let s = { current: 0, best: 0, lastDay: null as string | null }
    s = nextStreak(s, '2026-10-01')
    s = nextStreak(s, '2026-10-02')
    expect(s.current).toBe(2)
    s = nextStreak(s, '2026-10-02')
    expect(s.current).toBe(2)
    s = nextStreak(s, '2026-10-05')
    expect(s).toEqual({ current: 1, best: 2, lastDay: '2026-10-05' })
  })
})
