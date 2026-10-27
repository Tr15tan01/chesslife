'use client'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: '#12151c', color: '#efe7d6', fontFamily: 'system-ui', display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p>Please try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: '10px 18px', borderRadius: 999, border: 0, background: '#c9a45c', color: '#1b160c' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
