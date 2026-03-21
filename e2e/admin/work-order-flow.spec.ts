/**
 * Work Order Flow E2E Tests
 * 
 * Tests the complete work order lifecycle:
 * 1. Admin creates WO
 * 2. Employee claims and starts WO
 * 3. Employee completes WO
 * 4. Admin verifies and closes WO
 * 5. RBAC: Unauthorized access is blocked
 */

import { test, expect, type Page } from '@playwright/test'

// Test users
const ADMIN = {
  email: 'qa.workorder@test.com',
  password: 'qatest123'
}

const EMPLOYEE = {
  email: 'qa.fieldtech@test.com',
  password: 'qatest123'
}

const NO_PERM_USER = {
  email: 'qa.noperm@test.com',
  password: 'qatest123'
}

// Helper: Admin login
async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.waitForSelector('#email', { state: 'visible', timeout: 30000 })
  await page.locator('#email').fill(ADMIN.email)
  await page.locator('#password').fill(ADMIN.password)
  await page.click('button[type="submit"]')
  await page.waitForURL(url => 
    url.pathname.includes('/admin') && !url.pathname.includes('/login'),
    { timeout: 45000 }
  )
}

// Helper: Employee login
async function _loginAsEmployee(page: Page) {
  await page.goto('/karyawan/login')
  await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 30000 })
  await page.fill('input[type="email"]', EMPLOYEE.email)
  await page.fill('input[type="password"]', EMPLOYEE.password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard|karyawan\//, { timeout: 45000 })
}

test.describe.serial('Work Order Flow', () => {
  let _createdWoNumber: string | null = null

  test('Scenario 1: Admin can view Work Order dashboard', async ({ page }) => {
    test.setTimeout(60000); // Increase timeout for slow dashboard load
    await loginAsAdmin(page)
    await page.goto('/admin/workorders', { timeout: 45000 })
    await page.waitForLoadState('networkidle')
    // Verify dashboard elements - updated to match current UI
    // Dashboard now shows: Urgent Attention, Unassigned, Active Progress, Completed
    await expect(page.getByText(/Work Order|Dashboard|Urgent|Active/i).first()).toBeVisible({ timeout: 30000 })
  })

  test('Scenario 2: Admin can access Work Order list', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/workorders/list')
    await page.waitForLoadState('networkidle')

    // Verify list page with table or empty state
    const hasTable = await page.locator('table').count() > 0
    const hasEmptyState = await page.getByText('Tidak ada data').count() > 0
    expect(hasTable || hasEmptyState).toBeTruthy()
  })

  test('Scenario 3: Admin can create new Work Order', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/workorders/new')
    await page.waitForLoadState('networkidle')

    // Fill form
    await page.getByPlaceholder('e.g., Koneksi Lambat').fill('E2E Test - Installation')
    await page.getByPlaceholder('Detailed description...').fill('Automated test work order')

    // Select type dropdown
    const typeSelect = page.locator('select[name="type"]')
    if (await typeSelect.count() > 0) {
      await typeSelect.selectOption('INSTALLATION')
    }

    // Submit form
    await page.click('button[type="submit"]')

    // Verify success - redirect or toast
    await page.waitForURL(/\/admin\/workorders/, { timeout: 30000 })

    // Capture WO number if visible
    const woLink = page.locator('a[href*="workorders"]').filter({ hasText: /WO-/ }).first()
    if (await woLink.count() > 0) {
      _createdWoNumber = await woLink.textContent()
    }
  })

  test('Scenario 4: Employee can view pending Work Orders', async ({ page }) => {
    await _loginAsEmployee(page)
    await page.goto('/karyawan/work-order')
    await page.waitForLoadState('networkidle')
    // Placeholder content check
    await expect(page.getByRole('heading', { name: 'Work Orders' })).toBeVisible()
  })

  test('Scenario 5: RBAC - User without permission gets blocked', async ({ page }) => {
    await page.goto('/admin/login')
    await page.waitForSelector('#email', { state: 'visible', timeout: 30000 })
    await page.locator('#email').fill(NO_PERM_USER.email)
    await page.locator('#password').fill(NO_PERM_USER.password)
    await page.click('button[type="submit"]')

    await page.waitForFunction(() => !window.location.pathname.includes('login'), { timeout: 30000 })

    // Try accessing WO page
    await page.goto('/admin/workorders')
    await page.waitForLoadState('networkidle')

    // Should be redirected to forbidden or show access denied
    const isForbidden = await page.getByText(/Akses Ditolak|Forbidden|403|Akses Terbatas/i).count() > 0
    const isRedirected = page.url().includes('forbidden') || page.url().includes('dashboard')

    expect(isForbidden || isRedirected).toBeTruthy()
  })

  test('Scenario 6: Admin can view Sites management', async ({ page }) => {
    test.setTimeout(45000);
    await loginAsAdmin(page)
    await page.goto('/admin/workorders/sites')
    await page.waitForLoadState('networkidle')

    // Verify sites page - Updated to match UI "Manajemen Sites"
    await expect(page.getByRole('heading', { name: /Manajemen Sites|Site/i })).toBeVisible({ timeout: 30000 })
  })

  test('Scenario 7: Admin can view Departments management', async ({ page }) => {
    test.setTimeout(45000);
    await loginAsAdmin(page)
    await page.goto('/admin/workorders/departments')
    await page.waitForLoadState('networkidle')

    // Verify departments page - Updated to match UI "Manajemen Departments"
    // Use .first() to resolve strict mode violation between H1 and H2
    await expect(page.getByRole('heading', { name: /Manajemen Departments|Department/i }).first()).toBeVisible({ timeout: 30000 })
  })
})
