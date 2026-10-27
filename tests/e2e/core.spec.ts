import { expect, test } from '@playwright/test'
import { desk, register, side, startScenario } from './helpers'

test.describe('Classic negotiation', () => {
  test('a new user registers, negotiates and sees results', async ({ page }) => {
    await register(page)
    await startScenario(page, 'buy-used-car', /Play in Classic mode/)

    // Questions reveal hidden facts.
    await desk(page).getByRole('button', { name: /tyres and the service history/ }).click()
    await expect(desk(page).getByText(/You learned: The tyres need replacing/)).toBeVisible()

    // Offers receive deterministic counteroffers.
    await desk(page).getByRole('tab', { name: 'Make an offer' }).click()
    await desk(page).getByRole('button', { name: 'Make this offer' }).click()
    await expect(desk(page).getByText(/Their offer: \$/).first()).toBeVisible()
    const counter = await desk(page).getByText(/Their offer: \$/).first().textContent()
    expect(counter).toMatch(/\$10,\d00/)

    // Complete the game.
    await side(page).getByRole('button', { name: 'Accept' }).click()
    await expect(page.getByText('Agreement reached')).toBeVisible()
    await page.getByRole('link', { name: 'See your debrief' }).first().click()
    await page.waitForURL(/\/results\//)
    await expect(page.getByRole('heading', { name: 'Scorecard' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'What was hidden' })).toBeVisible()
    await expect(page.getByRole('meter', { name: 'Outcome quality score' })).toBeVisible()
  })

  test('the same moves produce the same counteroffer', async ({ page }) => {
    await register(page)
    const counters: string[] = []
    for (let i = 0; i < 2; i++) {
      await startScenario(page, 'ask-for-a-raise', /Play in Classic mode/)
      await desk(page).getByRole('tab', { name: 'Make an offer' }).click()
      await desk(page).getByRole('button', { name: 'Make this offer' }).click()
      const chip = desk(page).getByText(/Their offer: \$/).first()
      await expect(chip).toBeVisible()
      counters.push((await chip.textContent()) ?? '')
    }
    expect(counters[0]).toBe(counters[1])
  })
})

test.describe('AI negotiation (mock provider)', () => {
  test('plays an AI game and reviews the evaluation', async ({ page }) => {
    await register(page)
    await startScenario(page, 'buy-used-car', /Play with the AI character/)
    await desk(page).getByLabel('Your message').fill('I understand you are busy. Why are you selling the car?')
    await desk(page).getByRole('button', { name: 'Send' }).click()
    await expect(desk(page).getByText('Simulated AI reply (mock provider)').first()).toBeVisible()
    await expect(desk(page).getByText(/You learned: The seller is relocating/)).toBeVisible()
    await side(page).getByRole('button', { name: 'Walk away' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Walk away' }).click()
    await page.getByRole('link', { name: 'See your debrief' }).first().click()
    await page.waitForURL(/\/results\//)
    await expect(page.getByText('Includes AI assessment')).toBeVisible()
    await expect(page.getByText('AI-assessed').first()).toBeVisible()
  })
})

test.describe('Access control', () => {
  test('a user cannot open another user’s game', async ({ browser }) => {
    const a = await browser.newPage()
    await register(a)
    await startScenario(a, 'buy-used-car', /Play in Classic mode/)
    const gameUrl = a.url()
    const b = await (await browser.newContext()).newPage()
    await register(b)
    await b.goto(gameUrl)
    await expect(b.getByRole('heading', { name: 'Nothing on this table' })).toBeVisible()
    await expect(b.getByText('Buying a used car')).toHaveCount(0)
    const api = await b.request.get(gameUrl.replace('/play/', '/api/games/'))
    expect(api.status()).toBe(404)
  })

  test('a non-admin cannot reach the admin dashboard', async ({ page }) => {
    await register(page)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Nothing on this table' })).toBeVisible()
    await expect(page.getByText('Administration')).toHaveCount(0)
    const api = await page.request.get('/api/admin/users')
    expect(api.status()).toBe(403)
  })

  test('signed-out visitors are sent to sign in', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/)
  })
})

test.describe('AI disabled', () => {
  const base = 'http://localhost:3101'
  test('the app stays fully usable in Classic mode', async ({ page }) => {
    await register(page, base)
    await page.goto(`${base}/scenarios/ask-for-a-discount`)
    await expect(page.getByRole('button', { name: 'AI mode unavailable' })).toBeDisabled()
    await startScenario(page, 'ask-for-a-discount', /Play in Classic mode/, base)
    await desk(page).getByRole('button', { name: /corporate or partner rates/ }).click()
    await expect(desk(page).getByText(/You learned/)).toBeVisible()
    await side(page).getByRole('button', { name: 'Walk away' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Walk away' }).click()
    await expect(page.getByText('You walked away')).toBeVisible()
  })
})

test.describe('Public site', () => {
  test('landing page and navigation work', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Master the Art')
    await page.getByRole('button', { name: 'Ask why he is selling' }).click()
    await expect(page.getByText(/You learned:/)).toBeVisible()
    for (const [name, path] of [['Scenarios', '/scenarios'], ['How it works', '/how-it-works'], ['Features', '/features'], ['Pricing', '/pricing'], ['FAQ', '/faq']] as const) {
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click()
      await expect(page).toHaveURL(new RegExp(path))
    }
  })
})
