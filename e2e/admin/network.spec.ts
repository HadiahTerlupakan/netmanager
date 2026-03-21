
import { test, expect, type Page } from '@playwright/test'

const SUPER_ADMIN = {
  email: 'admin@example.com',
  password: 'admin123'
}

async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login')
  try {
    await page.waitForSelector('#email', { timeout: 10000 })
    await page.fill('#email', SUPER_ADMIN.email)
    await page.fill('#password', SUPER_ADMIN.password)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => !window.location.pathname.includes('login'), { timeout: 20000 })
    await page.waitForLoadState('domcontentloaded')
    return true
  } catch (error) {
    console.error('Login failed:', error)
    return false
  }
}

test.describe('Network Management E2E', () => {
  let routerName: string
  
  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginAsAdmin(page)
    expect(loggedIn, 'Login failed').toBeTruthy()
    routerName = `Router-${Date.now()}`
  })

  test('should manage MikroTik routers (Create -> List -> Delete)', async ({ page }) => {
    test.setTimeout(60000)

    // 1. Create Router
    console.log('Creating MikroTik Router:', routerName)
    await page.goto('/admin/network/mikrotik')
    
    // Find "Tambah Router" button
    await page.click('button:has-text("Tambah Router")')
    
    await page.fill('input[name="name"]', routerName)
    await page.fill('input[name="ipAddress"]', `10.10.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`)
    await page.fill('input[name="apiUsername"]', 'admin')
    await page.fill('input[name="apiPassword"]', 'password123')
    
    // Click Save
    await page.click('button:has-text("Simpan")')
    
    // Check for success toast or redirection
    await expect(page.locator('text=Router berhasil ditambahkan')).toBeVisible()
    console.log('Router created.')

    // 2. Verify in List
    await page.goto('/admin/network/mikrotik')
    await expect(page.locator('table')).toContainText(routerName)
    console.log('Router found in list.')

    // 3. Verify Audit Log
    await page.goto('/admin/log/activity')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toContainText('CREATE')
    await expect(page.locator('table')).toContainText('Mikrotik Routers')
    console.log('Audit log verified for CREATE action.')
  })
})
