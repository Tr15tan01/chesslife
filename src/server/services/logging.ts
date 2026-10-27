import 'server-only'
import { getDb } from '../db'

const REDACT = /(password|token|secret|authorization|cookie|api[_-]?key)=?[^\s&]*/gi

/** Structured error log. Never includes request bodies, tokens or passwords. */
export async function logError(scope: string, err: unknown, context?: string, userId: string | null = null) {
  const message = (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).replace(REDACT, '$1=[redacted]').slice(0, 500)
  console.error(JSON.stringify({ level: 'error', scope, context, message, at: new Date().toISOString() }))
  try {
    const db = await getDb()
    await db.errors.insertOne({ _id: crypto.randomUUID(), scope: `${scope}${context ? ` ${context}` : ''}`.slice(0, 120), message, createdAt: new Date(), userId })
  } catch {
    /* logging must never throw */
  }
}

export async function audit(actor: { id: string; email: string } | null, action: string, targetType: string, targetId: string | null, meta: Record<string, unknown> = {}) {
  const db = await getDb()
  await db.audit.insertOne({
    _id: crypto.randomUUID(),
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? null,
    action,
    targetType,
    targetId,
    meta,
    createdAt: new Date(),
  })
}
