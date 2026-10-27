import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against production builds (`npm run build` first).
 * Two servers: one with the deterministic mock AI provider, one with AI
 * disabled. No paid model APIs are ever called.
 */
const common = {
  DATABASE_URL: 'memory://e2e',
  DEALCRAFT_ALLOW_MEMORY_DB: '1',
  AUTH_SECRET: 'e2e-only-secret-0123456789abcdefghijklmnopqrstuvwxyz',
  RATE_LIMIT_ENABLED: '0',
  GOOGLE_AUTH_ENABLED: '0',
}

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx next start -p 3100',
      url: 'http://localhost:3100/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { ...common, AUTH_URL: 'http://localhost:3100', AI_ENABLED: '1', AI_PROVIDER: 'mock' },
    },
    {
      command: 'npx next start -p 3101',
      url: 'http://localhost:3101/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { ...common, AUTH_URL: 'http://localhost:3101', AI_ENABLED: '0' },
    },
  ],
})
