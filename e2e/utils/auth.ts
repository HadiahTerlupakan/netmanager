import { type Page } from '@playwright/test'

// Reusable login function
export async function loginAsAdmin(page: Page, email: string, password: string) {
  await page.goto('/admin/login')

  // Wait for login form
  await page.waitForSelector('#email')

  // Fill login credentials using correct selectors
  await page.fill('#email', email)
  await page.fill('#password', password)

  // Click login button
  await page.click('button[type="submit"]')
  // Wait for navigation to complete (login success) - strict check
  await page.waitForURL((url) => url.pathname === '/admin' || url.pathname === '/admin/dashboard', { timeout: 15000 });
}
