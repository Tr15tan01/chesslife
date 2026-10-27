'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api-client'
import { useToast } from '@/components/ui/toast'

export type StartInput = { slug: string; mode?: 'CLASSIC' | 'AI'; variant?: 'STANDARD' | 'QUICK' | 'CHALLENGE' | 'ACADEMY' | 'CUSTOM'; timed?: boolean; challengeSlug?: string; lessonSlug?: string }

export function StartButton({ input, children, ...props }: { input: StartInput } & Omit<ButtonProps, 'onClick' | 'input'>) {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  return (
    <Button
      {...props}
      loading={loading}
      onClick={async () => {
        setLoading(true)
        try {
          const r = await api<{ id: string }>('/api/games', { body: input })
          router.push(`/play/${r.id}`)
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) router.push(`/login?next=${encodeURIComponent(location.pathname)}`)
          else toast(e instanceof Error ? e.message : 'Could not start the game.', 'bad')
          setLoading(false)
        }
      }}
    >
      {children}
    </Button>
  )
}
