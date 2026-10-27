import { expect, type Page } from '@playwright/test'

export async function register(page: Page, base = '') {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  await page.goto(`${base}/register`)
  await page.getByLabel('Name').fill('E2E Player')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('Negotiate-2026!')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL(/\/dashboard/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E')
  return email
}

export async function startScenario(page: Page, slug: string, button: RegExp, base = '') {
  await page.goto(`${base}/scenarios/${slug}`)
  await page.getByRole('button', { name: button }).click()
  await page.waitForURL(/\/play\/[0-9a-f-]{36}/)
  await page.getByRole('button', { name: 'Begin negotiation' }).click()
}

export const desk = (page: Page) => page.locator('section[aria-label="Negotiation"]')
export const side = (page: Page) => page.locator('aside[aria-label="Status and actions"]')
