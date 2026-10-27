import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    pool: 'forks',
    testTimeout: 30000,
  },
  resolve: { alias: { 'server-only': new URL('./tests/server-only-stub.ts', import.meta.url).pathname } },
})
