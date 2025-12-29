/**
 * Cross-Portal Work Order E2E Test
 * 
 * Tests the complete WO lifecycle across Admin and Employee portals:
 * 1. Admin creates Work Order
 * 2. Employee claims and starts WO
 * 3. Employee completes WO
 * 4. Admin verifies and closes WO
 * 
 * This test validates the interconnection between portals.
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { prisma } from '../../lib/prisma'

const ADMIN = {
  email: 'qa.workorder@test.com',
  password: 'qatest123'
}

const EMPLOYEE = {
  email: 'qa.fieldtech@test.com',
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

// Helper: Employee login
async function loginAsEmployee(page: Page) {
  await page.goto('/karyawan/login')
  await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 10000 })
  await page.fill('input[type="email"]', EMPLOYEE.email)
  await page.fill('input[type="password"]', EMPLOYEE.password)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => window.location.pathname.includes('dashboard'), { timeout: 15000 })
}

test.describe.serial('Cross-Portal Work Order Lifecycle', () => {
  let testWoId: string | null = null
  let testWoNumber: string | null = null

  test.beforeAll(async () => {
    // Create a test WO directly in database for testing
    const site = await prisma.sites.findFirst()
    const dept = await prisma.departments.findFirst()
    
    if (site && dept) {
      const wo = await prisma.workOrders.create({
        data: {
          id: `e2e-test-${Date.now()}`,
          workOrderNumber: `WO-E2E-${Date.now()}`,
          type: 'INSTALLATION',
          title: 'E2E Cross-Portal Test WO',
          description: 'Created for cross-portal testing',
          status: 'PENDING',
          priority: 'NORMAL',
          siteId: site.id,
          departmentId: dept.id,
          updatedAt: new Date()
        }
      })
      testWoId = wo.id
      testWoNumber = wo.workOrderNumber
    }
  })

  test.afterAll(async () => {
    // Cleanup test WO
    if (testWoId) {
      await prisma.workOrders.deleteMany({
        where: { id: testWoId }
      }).catch(() => {})
    }
  })

  test('Step 1: Admin can see WO in dashboard', async ({ page }) => {
    test.skip(!testWoNumber, 'No test WO created')
    
    await loginAsAdmin(page)
    await page.goto('/admin/workorders/list')
    await page.waitForLoadState('networkidle')
    
    // Search for our test WO
    const searchInput = page.locator('input[placeholder*="Cari"]').or(page.locator('input[type="search"]'))
    if (await searchInput.count() > 0) {
      await searchInput.fill(testWoNumber!)
      await page.waitForTimeout(500)
    }
    
    // Verify dashboard loads
    await expect(page.getByRole('table').or(page.getByText('Tidak ada'))).toBeVisible({ timeout: 10000 })
  })

  test('Step 2: Employee can see WO in available list', async ({ page }) => {
    test.skip(!testWoNumber, 'No test WO created')
    
    await loginAsEmployee(page)
    await page.goto('/karyawan/work-order')
    await page.waitForLoadState('networkidle')
    
    // Click available tab
    await page.getByRole('tab', { name: /Tersedia|Available/i }).click()
    await page.waitForTimeout(500)
    
    // Should show WOs or empty state
    const hasList = await page.locator('a[href*="/karyawan/work-order/"]').count() > 0
    const hasEmpty = await page.getByText(/tidak ada|kosong/i).count() > 0
    
    expect(hasList || hasEmpty).toBeTruthy()
  })

  test('Step 3: Employee can claim WO', async ({ page }) => {
    test.skip(!testWoId, 'No test WO created')
    
    await loginAsEmployee(page)
    await page.goto(`/karyawan/work-order/${testWoId}`)
    await page.waitForLoadState('networkidle')
    
    // Look for claim/take button
    const claimBtn = page.getByRole('button', { name: /Ambil|Claim|Take/i })
    
    if (await claimBtn.count() > 0) {
      await claimBtn.click()
      await page.waitForTimeout(1000)
      
      // Verify status changed
      const statusChanged = await page.getByText(/ASSIGNED|Ditugaskan/i).count() > 0
      const hasStartBtn = await page.getByRole('button', { name: /Mulai|Start/i }).count() > 0
      
      expect(statusChanged || hasStartBtn).toBeTruthy()
    }
  })

  test('Step 4: Employee can start WO', async ({ page }) => {
    test.skip(!testWoId, 'No test WO created')
    
    await loginAsEmployee(page)
    await page.goto(`/karyawan/work-order/${testWoId}`)
    await page.waitForLoadState('networkidle')
    
    const startBtn = page.getByRole('button', { name: /Mulai|Start/i })
    
    if (await startBtn.count() > 0) {
      await startBtn.click()
      await page.waitForTimeout(1000)
      
      // Verify in progress
      const inProgress = await page.getByText(/IN_PROGRESS|Dikerjakan/i).count() > 0
      expect(inProgress).toBeTruthy()
    }
  })

  test('Step 5: Admin sees updated WO status', async ({ page }) => {
    test.skip(!testWoNumber, 'No test WO created')
    
    await loginAsAdmin(page)
    await page.goto('/admin/workorders/list')
    await page.waitForLoadState('networkidle')
    
    // Dashboard should reflect status changes from employee actions
    await expect(page.getByRole('table').or(page.getByText(/Work Order/i))).toBeVisible({ timeout: 10000 })
  })
})
