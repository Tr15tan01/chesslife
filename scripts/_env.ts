import { existsSync, readFileSync } from 'node:fs'

/** Minimal .env loader for CLI scripts (does not override existing variables). */
for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m || line.trim().startsWith('#')) continue
    const [, k, raw] = m
    const v = raw!.replace(/^['"]|['"]$/g, '')
    if (process.env[k!] === undefined) process.env[k!] = v
  }
}
