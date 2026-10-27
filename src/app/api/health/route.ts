import { NextResponse } from 'next/server'
import { getDb } from '@/server/db'

export async function GET() {
  try {
    await (await getDb()).scenarios.countDocuments({})
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
