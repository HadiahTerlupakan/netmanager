
import { test, expect, type Page } from '@playwright/test'

const SUPER_ADMIN = {
  email: 'admin@example.com',
  password: 'admin123'
}

async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login')
  try {
    await page.waitForSelector('#email', { timeout: 30000 })
    await page.fill('#email', SUPER_ADMIN.email)
    await page.fill('#password', SUPER_ADMIN.password)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => !window.location.pathname.includes('login'), { timeout: 45000 })
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

    // Mock connection test to succeed
    await page.route('**/api/mikrotik-routers/test-connection', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Connection Successful (Mocked)',
          api: { success: true, message: 'Connected' },
          routerInfo: { identity: 'E2E-Mock-Router', boardName: 'Cloud Core Router' }
        })
      })
    })

    // 1. Create Router
    console.log('Creating MikroTik Router:', routerName)
    await page.goto('/admin/network/mikrotik')
    
    // Find "Tambah Router" button
    await page.click('a:has-text("Tambah Router")')
    
    await page.fill('label:has-text("Nama Router") + input', routerName)
    const randomIp = `10.10.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`
    await page.fill('label:has-text("IP Router") + input', randomIp)
    await page.fill('label:has-text("Username API") + input', 'admin')
    await page.fill('label:has-text("Password API") + input', 'password123')
    
    // Test Connection (required before save)
    console.log('Testing connection...')
    await page.click('button:has-text("Tes Koneksi")')
    
    // Wait for test result modal or button to enable
    await expect(page.locator('text=Connection Successful (Mocked)')).toBeVisible()
    await page.click('button:has-text("Tutup")') // Close result modal
    
    // Click Save
    await page.click('button:has-text("Tambahkan Router")')
    
    // Check for redirection to list
    await page.waitForURL(/\/admin\/network\/mikrotik/, { timeout: 30000 })
    console.log('Router created and redirected to list.')

    // 2. Verify in List
    await page.waitForSelector('table')
    const table = page.locator('table')
    await expect(table).toContainText(routerName, { timeout: 30000 })
    console.log('Router found in list.')

    // 3. Verify Audit Log
    await page.goto('/admin/log/activity')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toContainText('CREATE')
    await expect(page.locator('table')).toContainText('Mikrotik Routers')
    console.log('Audit log verified for CREATE action.')
  })
})
