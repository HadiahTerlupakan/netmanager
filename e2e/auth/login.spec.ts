import { test, expect, type Page } from '@playwright/test'

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

test.describe('Admin Authentication', () => {
  test('should show login page with form elements', async ({ page }) => {
    await page.goto('/admin/login')
    
    // Check login form exists with correct IDs
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    
    // Check page title
    await expect(page).toHaveTitle(/NetManager/)
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/admin/login')
    
    // Fill with invalid credentials
    await page.fill('#email', 'invalid@email.com')
    await page.fill('#password', 'wrongpassword123')
    
    // Submit
    await page.click('button[type="submit"]')
    
    // Wait for error message or stay on login page
    await page.waitForTimeout(3000)
    
    // Should still be on login page or show error
    const url = page.url()
    const hasError = await page.locator('text=salah').isVisible().catch(() => false) ||
                     await page.locator('text=gagal').isVisible().catch(() => false)
    
    expect(url.includes('login') || hasError).toBeTruthy()
  })

  test('should have password field with correct type', async ({ page }) => {
    await page.goto('/admin/login')
    
    const passwordInput = page.locator('#password')
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('should show NetManager branding', async ({ page }) => {
    await page.goto('/admin/login')
    
    // Check for NetManager text
    await expect(page.locator('text=NetManager')).toBeVisible()
  })
})
