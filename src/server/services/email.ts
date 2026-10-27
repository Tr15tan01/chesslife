import 'server-only'
import { emailConfigured, env } from '../env'

/**
 * Outbound email via the Resend HTTP API when RESEND_API_KEY and EMAIL_FROM
 * are set. Without them, email-dependent flows degrade gracefully: links are
 * printed to the server console in development only, never in production.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!emailConfigured()) {
    if (env().NODE_ENV !== 'production') {
      console.info(`[email:dev] To: ${to}\nSubject: ${subject}\n\n${text}\n`)
      return true
    }
    return false
  }
  const e = env()
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: e.EMAIL_FROM, to, subject, text }),
      signal: AbortSignal.timeout(10000),
    })
    return res.ok
  } catch {
    return false
  }
}

export function canSendEmail(): boolean {
  return emailConfigured() || env().NODE_ENV !== 'production'
}
