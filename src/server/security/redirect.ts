/**
 * Only same-origin relative paths are allowed as post-login destinations.
 * Rejects absolute URLs, protocol-relative URLs, backslash tricks and
 * control characters.
 */
export function safeRedirect(target: unknown, fallback = '/dashboard'): string {
  if (typeof target !== 'string' || target.length === 0 || target.length > 512) return fallback
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback
  if (/[\u0000-\u001f\\]/.test(target)) return fallback
  try {
    const u = new URL(target, 'http://internal.invalid')
    if (u.origin !== 'http://internal.invalid') return fallback
    if (u.pathname.startsWith('/api/')) return fallback
    return `${u.pathname}${u.search}${u.hash}`
  } catch {
    return fallback
  }
}
