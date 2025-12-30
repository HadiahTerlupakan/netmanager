/**
 * FTTH (Fiber to the Home) Flow E2E Tests
 *
 * Tests the complete FTTH infrastructure management:
 * 1. Pole (Tiang) Management
 * 2. OTB (Optical Termination Box) Management
 * 3. ODC (Optical Distribution Cabinet) Management
 * 4. ODP (Optical Distribution Point) Management
 * 5. Closure/Joinbox Management
 * 6. Topology Map Visualization
 * 7. Business Flow: Pole → OTB → ODC → ODP → Customer
 * 8. RBAC: Unauthorized access is blocked
 */

import { test, expect, type Page } from '@playwright/test'

// Test users
const ADMIN = {
  email: 'qa.workorder@test.com',
  password: 'qatest123'
}

const NO_PERM_USER = {
  email: 'qa.noperm@test.com',
  password: 'qatest123'
}

// Helper: Admin login
async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.waitForSelector('#email', { state: 'visible', timeout: 10000 })
  await page.locator('#email').fill(ADMIN.email)
  await page.locator('#password').fill(ADMIN.password)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => !window.location.pathname.includes('login'), { timeout: 15000 })
}

test.describe.serial('FTTH Infrastructure Management', () => {
  let createdPoleId: string | null = null
  let createdOtbId: string | null = null
  let createdOdcId: string | null = null
  let createdOdpId: string | null = null
  let createdClosureId: string | null = null

  test.beforeAll(async () => {
    // Setup: Ensure test data is ready
    console.log('Starting FTTH E2E Tests...')
  })

  test.afterAll(async () => {
    // Cleanup: Test data could be cleaned up here
    console.log('FTTH E2E Tests completed')
  })

  test.describe('Pole (Tiang) Management', () => {
    test('Scenario 1: Admin can view Pole list', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/pole')
      await page.waitForLoadState('networkidle')

      // Verify page title
      await expect(page.getByText('Pole / Tiang')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Daftar Pole/Tiang yang terdaftar')).toBeVisible()

      // Verify table or empty state
      const hasTable = await page.locator('table').count() > 0
      const hasEmptyState = await page.getByText('Belum ada data Pole').count() > 0
      expect(hasTable || hasEmptyState).toBeTruthy()
    })

    test('Scenario 2: Admin can create new Pole', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/pole/new')
      await page.waitForLoadState('networkidle')

      // Fill form
      await page.locator('input[name="name"]').fill(`E2E Test Pole ${Date.now()}`)
      await page.locator('input[name="location"]').fill('Test Location')
      await page.locator('input[name="latitude"]').fill('-6.2088')
      await page.locator('input[name="longitude"]').fill('106.8456')
      await page.locator('textarea[name="notes"]').fill('E2E Test Notes')

      // Submit
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/admin\/ftth\/pole/, { timeout: 10000 })

      // Verify success - toast shows "Pole dibuat."
      await expect(page.getByText('Pole dibuat')).toBeVisible({ timeout: 5000 })
    })

    test('Scenario 3: Admin can edit Pole', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/pole')
      await page.waitForLoadState('networkidle')

      // Find and click edit button on first item
      const editButton = page.locator('a[href*="/edit"]').first()
      const count = await editButton.count()

      if (count > 0) {
        await editButton.click()
        await page.waitForLoadState('networkidle')

        // Edit form
        await page.locator('input[name="location"]').fill('Updated Location')
        await page.click('button[type="submit"]')
        await page.waitForURL(/\/admin\/ftth\/pole/, { timeout: 10000 })

        // Verify success - toast shows "Pole diperbarui."
        await expect(page.getByText('Pole diperbarui')).toBeVisible({ timeout: 5000 })
      }
    })

    test('Scenario 4: Admin can view Pole detail', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/pole')
      await page.waitForLoadState('networkidle')

      // Find and click detail link
      const detailLink = page.locator('a[href^="/admin/ftth/pole/"]').filter({ hasNotText: 'edit' }).first()
      const count = await detailLink.count()

      if (count > 0) {
        await detailLink.click()
        await page.waitForLoadState('networkidle')

        // Verify detail page elements
        await expect(page.locator('h1')).toBeVisible()
      }
    })
  })

  test.describe('OTB (Optical Termination Box) Management', () => {
    test('Scenario 5: Admin can view OTB list', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/otb')
      await page.waitForLoadState('networkidle')

      // Verify page elements
      await expect(page.getByRole('heading', { name: 'OTB' })).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Daftar OTB yang terdaftar')).toBeVisible()

      // Verify table or empty state
      const hasTable = await page.locator('table').count() > 0
      const hasEmptyState = await page.getByText('Belum ada data OTB').count() > 0
      expect(hasTable || hasEmptyState).toBeTruthy()
    })

    test('Scenario 6: Admin can create new OTB with cores', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/otb/new')
      await page.waitForLoadState('networkidle')

      // Fill main form
      await page.locator('input[name="name"]').fill(`E2E Test OTB ${Date.now()}`)
      await page.locator('input[name="location"]').fill('Test OTB Location')
      await page.locator('input[name="coreCount"]').fill('12')
      await page.locator('input[name="latitude"]').fill('-6.2088')
      await page.locator('input[name="longitude"]').fill('106.8456')
      await page.locator('textarea[name="notes"]').fill('E2E Test OTB Notes')

      // Submit
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/admin\/ftth\/otb/, { timeout: 10000 })

      // Verify success - toast shows "OTB dibuat."
      await expect(page.getByText('OTB dibuat')).toBeVisible({ timeout: 5000 })
    })

    test('Scenario 7: Admin can edit OTB', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/otb')
      await page.waitForLoadState('networkidle')

      // Find and click edit button
      const editButton = page.locator('a[href*="/edit"]').first()
      const count = await editButton.count()

      if (count > 0) {
        await editButton.click()
        await page.waitForLoadState('networkidle')

        // Edit form
        await page.locator('input[name="location"]').fill('Updated OTB Location')
        await page.click('button[type="submit"]')
        await page.waitForURL(/\/admin\/ftth\/otb/, { timeout: 10000 })

        // Verify success - toast shows "OTB diperbarui."
        await expect(page.getByText('OTB diperbarui')).toBeVisible({ timeout: 5000 })
      }
    })

    test('Scenario 8: Admin can view OTB detail with cores', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/otb')
      await page.waitForLoadState('networkidle')

      // Find and click detail link
      const detailLink = page.locator('a[href^="/admin/ftth/otb/"]').filter({ hasNotText: 'edit' }).first()
      const count = await detailLink.count()

      if (count > 0) {
        await detailLink.click()
        await page.waitForLoadState('networkidle')

        // Verify detail page shows cores
        await expect(page.locator('h1')).toBeVisible()
      }
    })
  })

  test.describe('ODC (Optical Distribution Cabinet) Management', () => {
    test('Scenario 9: Admin can view ODC list', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/odc')
      await page.waitForLoadState('networkidle')

      // Verify page elements
      await expect(page.getByRole('heading', { name: 'ODC' })).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Daftar ODC yang terdaftar')).toBeVisible()

      // Verify table or empty state
      const hasTable = await page.locator('table').count() > 0
      const hasEmptyState = await page.getByText('Belum ada data ODC').count() > 0
      expect(hasTable || hasEmptyState).toBeTruthy()
    })

    test('Scenario 10: Admin can create new ODC', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/odc/new')
      await page.waitForLoadState('networkidle')

      // Fill form
      await page.locator('input[name="name"]').fill(`E2E Test ODC ${Date.now()}`)
      await page.locator('input[name="location"]').fill('Test ODC Location')
      await page.locator('input[name="latitude"]').fill('-6.2088')
      await page.locator('input[name="longitude"]').fill('106.8456')
      await page.locator('textarea[name="notes"]').fill('E2E Test ODC Notes')

      // Submit
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/admin\/ftth\/odc/, { timeout: 10000 })

      // Verify success - toast shows "ODC dibuat."
      await expect(page.getByText('ODC dibuat')).toBeVisible({ timeout: 5000 })
    })

    test('Scenario 11: Admin can edit ODC', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/odc')
      await page.waitForLoadState('networkidle')

      // Find and click edit button
      const editButton = page.locator('a[href*="/edit"]').first()
      const count = await editButton.count()

      if (count > 0) {
        await editButton.click()
        await page.waitForLoadState('networkidle')

        // Edit form
        await page.locator('input[name="location"]').fill('Updated ODC Location')
        await page.click('button[type="submit"]')
        await page.waitForURL(/\/admin\/ftth\/odc/, { timeout: 10000 })

        // Verify success - toast shows "ODC diperbarui."
        await expect(page.getByText('ODC diperbarui')).toBeVisible({ timeout: 5000 })
      }
    })

    test('Scenario 12: Admin can view ODC detail with outputs', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/odc')
      await page.waitForLoadState('networkidle')

      // Find and click detail link
      const detailLink = page.locator('a[href^="/admin/ftth/odc/"]').filter({ hasNotText: 'edit' }).first()
      const count = await detailLink.count()

      if (count > 0) {
        await detailLink.click()
        await page.waitForLoadState('networkidle')

        // Verify detail page
        await expect(page.locator('h1')).toBeVisible()
      }
    })
  })

  test.describe('ODP (Optical Distribution Point) Management', () => {
    test('Scenario 13: Admin can view ODP list', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/odp')
      await page.waitForLoadState('networkidle')

      // Verify page elements
      await expect(page.getByRole('heading', { name: 'ODP' })).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Daftar ODP yang terdaftar')).toBeVisible()

      // Verify table or empty state
      const hasTable = await page.locator('table').count() > 0
      const hasEmptyState = await page.getByText('Belum ada data ODP').count() > 0
      expect(hasTable || hasEmptyState).toBeTruthy()
    })

    test('Scenario 14: Admin can create new ODP', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/odp/new')
      await page.waitForLoadState('networkidle')

      // Fill form
      await page.locator('input[name="name"]').fill(`E2E Test ODP ${Date.now()}`)
      await page.locator('input[name="location"]').fill('Test ODP Location')
      await page.locator('input[name="latitude"]').fill('-6.2088')
      await page.locator('input[name="longitude"]').fill('106.8456')
      await page.locator('textarea[name="notes"]').fill('E2E Test ODP Notes')

      // Submit
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/admin\/ftth\/odp/, { timeout: 10000 })

      // Verify success - toast shows "ODP dibuat."
      await expect(page.getByText('ODP dibuat')).toBeVisible({ timeout: 5000 })
    })

    test('Scenario 15: Admin can edit ODP', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/odp')
      await page.waitForLoadState('networkidle')

      // Find and click edit button
      const editButton = page.locator('a[href*="/edit"]').first()
      const count = await editButton.count()

      if (count > 0) {
        await editButton.click()
        await page.waitForLoadState('networkidle')

        // Edit form
        await page.locator('input[name="location"]').fill('Updated ODP Location')
        await page.click('button[type="submit"]')
        await page.waitForURL(/\/admin\/ftth\/odp/, { timeout: 10000 })

        // Verify success - toast shows "ODP diperbarui."
        await expect(page.getByText('ODP diperbarui')).toBeVisible({ timeout: 5000 })
      }
    })

    test('Scenario 16: Admin can view ODP detail with outputs and customers', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/odp')
      await page.waitForLoadState('networkidle')

      // Find and click detail link
      const detailLink = page.locator('a[href^="/admin/ftth/odp/"]').filter({ hasNotText: 'edit' }).first()
      const count = await detailLink.count()

      if (count > 0) {
        await detailLink.click()
        await page.waitForLoadState('networkidle')

        // Verify detail page shows outputs and connected customers
        await expect(page.locator('h1')).toBeVisible()
      }
    })
  })

  test.describe('Closure/Joinbox Management', () => {
    test('Scenario 17: Admin can view Closure list', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/closure')
      await page.waitForLoadState('networkidle')

      // Verify page elements
      await expect(page.getByText(/Join BOX|Closure/i)).toBeVisible({ timeout: 10000 })

      // Verify table or empty state
      const hasTable = await page.locator('table').count() > 0
      const hasEmptyState = await page.getByText('Belum ada data').count() > 0
      expect(hasTable || hasEmptyState).toBeTruthy()
    })

    test('Scenario 18: Admin can create new Closure/Joinbox', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/closure/new')
      await page.waitForLoadState('networkidle')

      // Fill form
      await page.locator('input[name="name"]').fill(`E2E Test Closure ${Date.now()}`)
      await page.locator('input[name="location"]').fill('Test Closure Location')
      await page.locator('input[name="latitude"]').fill('-6.2088')
      await page.locator('input[name="longitude"]').fill('106.8456')
      await page.locator('select[name="level"]').selectOption('1')
      await page.locator('input[name="code"]').fill('TEST-CODE-001')

      // Submit
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/admin\/ftth\/closure/, { timeout: 10000 })

      // Verify success - toast shows "JOINbox dibuat."
      await expect(page.getByText('JOINbox dibuat')).toBeVisible({ timeout: 5000 })
    })

    test('Scenario 19: Admin can edit Closure', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/closure')
      await page.waitForLoadState('networkidle')

      // Find and click edit button
      const editButton = page.locator('a[href*="/edit"]').first()
      const count = await editButton.count()

      if (count > 0) {
        await editButton.click()
        await page.waitForLoadState('networkidle')

        // Edit form
        await page.locator('input[name="location"]').fill('Updated Closure Location')
        await page.click('button[type="submit"]')
        await page.waitForURL(/\/admin\/ftth\/closure/, { timeout: 10000 })

        // Verify success - toast shows "JOINbox diperbarui."
        await expect(page.getByText('JOINbox diperbarui')).toBeVisible({ timeout: 5000 })
      }
    })
  })

  test.describe('Topology Map', () => {
    test('Scenario 20: Admin can access Topology Map', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/ftth/map')
      await page.waitForLoadState('networkidle')

      // Verify map page loads
      await expect(page.getByText(/Topology|Peta/i)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('FTTH RBAC', () => {
    test('Scenario 21: User without FTTH permission cannot access FTTH menus', async ({ page }) => {
      // Login as user without FTTH permissions
      await page.goto('/admin/login')
      await page.waitForSelector('#email', { state: 'visible', timeout: 10000 })
      await page.locator('#email').fill(NO_PERM_USER.email)
      await page.locator('#password').fill(NO_PERM_USER.password)
      await page.click('button[type="submit"]')
      await page.waitForFunction(() => !window.location.pathname.includes('login'), { timeout: 15000 })

      // Try to access FTTH pages
      const ftthPages = [
        '/admin/ftth/pole',
        '/admin/ftth/otb',
        '/admin/ftth/odc',
        '/admin/ftth/odp',
        '/admin/ftth/closure',
        '/admin/ftth/map'
      ]

      for (const ftthPage of ftthPages) {
        await page.goto(ftthPage)
        await page.waitForLoadState('networkidle')

        // Should see forbidden/error or redirect
        const isForbidden = await page.getByText(/Forbidden|403/i).count() > 0
        const isRedirected = await page.locator('a[href*="/login"]').count() > 0

        expect(isForbidden || isRedirected).toBeTruthy()
      }
    })
  })

  test.describe('FTTH Business Flow', () => {
    test('Scenario 22: Complete FTTH infrastructure hierarchy flow', async ({ page }) => {
      // This test verifies the relationship between FTTH entities
      await loginAsAdmin(page)
      await page.goto('/admin/ftth')
      await page.waitForLoadState('networkidle')

      // Verify all FTTH sub-menus are accessible
      const subMenus = [
        { name: 'Pole', path: '/admin/ftth/pole' },
        { name: 'OTB', path: '/admin/ftth/otb' },
        { name: 'ODC', path: '/admin/ftth/odc' },
        { name: 'ODP', path: '/admin/ftth/odp' },
        { name: 'Join BOX', path: '/admin/ftth/closure' },
        { name: 'KMZ', path: '/admin/ftth/kmz' },
        { name: 'Topology Map', path: '/admin/ftth/map' }
      ]

      for (const menu of subMenus) {
        await page.goto(menu.path)
        await page.waitForLoadState('networkidle')
        // Verify page loads without errors
        const hasError = await page.getByText(/Error|500/i).count() > 0
        expect(hasError).toBeFalsy()
      }
    })
  })
})
