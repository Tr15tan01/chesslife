import { NextResponse } from 'next/server'
import { route } from '@/server/http'
import { exportUserData } from '@/server/services/accounts'
import { enforce, RULES } from '@/server/security/rate-limit'

export const GET = route({ auth: true }, async ({ user }) => {
  await enforce(RULES.account, user!.id)
  const data = await exportUserData(user!.id)
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dealcraft-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
})
