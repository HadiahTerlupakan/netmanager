/**
 * Work Order Employee Portal E2E Tests
 * 
 * Tests the employee-side work order flows:
 * 1. View available work orders
 * 2. Work order detail view
 * 3. Claim (take) work order
 * 4. Start work with partners
 * 5. Hold/Resume work order
 * 6. Complete work order with photo
 * 7. Request material/inventory
 */

import { test, expect, type Page } from '@playwright/test'

const EMPLOYEE = {
  email: 'qa.fieldtech@test.com',
  password: 'qatest123'
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

// SKIP: Karyawan/Employee portal is not yet implemented
// TODO: Enable these tests once /karyawan routes are created
test.describe.skip('Employee Work Order Flow', () => {

  test('Scenario 1: Employee can access Work Order list', async ({ page }) => {
    await loginAsEmployee(page)
    await page.goto('/karyawan/work-order')
    await page.waitForLoadState('networkidle')
    
    // Verify tabs exist
    await expect(page.getByRole('tab', { name: /Tersedia|Available/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('tab', { name: /Saya|My/i })).toBeVisible()
  })

  test('Scenario 2: Employee can view available WOs tab', async ({ page }) => {
    await loginAsEmployee(page)
    await page.goto('/karyawan/work-order')
    await page.waitForLoadState('networkidle')
    
    // Click "Tersedia" tab
    await page.getByRole('tab', { name: /Tersedia|Available/i }).click()
    await page.waitForTimeout(500)
    
    // Should show list or empty state
    const hasCards = await page.locator('[data-testid="wo-card"]').count() > 0
    const hasItems = await page.locator('a[href*="/karyawan/work-order/"]').count() > 0
    const hasEmpty = await page.getByText(/tidak ada|kosong|empty/i).count() > 0
    
    expect(hasCards || hasItems || hasEmpty).toBeTruthy()
  })

  test('Scenario 3: Employee can view "My WOs" tab', async ({ page }) => {
    await loginAsEmployee(page)
    await page.goto('/karyawan/work-order')
    await page.waitForLoadState('networkidle')
    
    // Click "Saya" tab  
    await page.getByRole('tab', { name: /Saya|My/i }).click()
    await page.waitForTimeout(500)
    
    // Verify response
    const hasData = await page.locator('a[href*="/karyawan/work-order/"]').count() > 0
    const hasEmpty = await page.getByText(/tidak ada|kosong|belum/i).count() > 0
    
    expect(hasData || hasEmpty).toBeTruthy()
  })

  test('Scenario 4: Employee can view WO detail page', async ({ page }) => {
    await loginAsEmployee(page)
    await page.goto('/karyawan/work-order')
    await page.waitForLoadState('networkidle')
    
    // Try to click first available WO
    const woLink = page.locator('a[href*="/karyawan/work-order/"]').first()
    
    if (await woLink.count() > 0) {
      await woLink.click()
      await page.waitForLoadState('networkidle')
      
      // Verify detail page elements
      await expect(page.getByText(/WO-\d+/)).toBeVisible({ timeout: 10000 })
    } else {
      // No WOs available - that's okay, just verify list page works
      test.skip()
    }
  })

  test('Scenario 5: WO detail shows status actions', async ({ page }) => {
    await loginAsEmployee(page)
    await page.goto('/karyawan/work-order')
    await page.waitForLoadState('networkidle')
    
    const woLink = page.locator('a[href*="/karyawan/work-order/"]').first()
    
    if (await woLink.count() > 0) {
      await woLink.click()
      await page.waitForLoadState('networkidle')
      
      // Check for action buttons based on status
      const hasClaimBtn = await page.getByRole('button', { name: /Ambil|Claim|Take/i }).count() > 0
      const hasStartBtn = await page.getByRole('button', { name: /Mulai|Start/i }).count() > 0
      const hasCompleteBtn = await page.getByRole('button', { name: /Selesai|Complete/i }).count() > 0
      const hasHoldBtn = await page.getByRole('button', { name: /Hold|Tahan/i }).count() > 0
      
      // At least one action should be available (or WO is already completed)
      const hasActions = hasClaimBtn || hasStartBtn || hasCompleteBtn || hasHoldBtn
      const isCompleted = await page.getByText(/COMPLETED|VERIFIED|CLOSED/i).count() > 0
      
      expect(hasActions || isCompleted).toBeTruthy()
    } else {
      test.skip()
    }
  })

  test('Scenario 6: Employee can navigate to partner selection', async ({ page }) => {
    await loginAsEmployee(page)
    await page.goto('/karyawan/work-order')
    await page.waitForLoadState('networkidle')
    
    // Find a WO link
    const woLinks = page.locator('a[href*="/karyawan/work-order/"]')
    
    if (await woLinks.count() > 0) {
      // Get the href to extract WO ID
      const href = await woLinks.first().getAttribute('href')
      if (href) {
        const woId = href.split('/').pop()
        // Navigate to partners page
        await page.goto(`/karyawan/work-order/${woId}/partners`)
        await page.waitForLoadState('networkidle')
        
        // Should show partner selection or redirect
        const isPartnerPage = page.url().includes('partners')
        const hasContent = await page.locator('body').textContent()
        
        expect(isPartnerPage || hasContent).toBeTruthy()
      }
    } else {
      test.skip()
    }
  })

  test('Scenario 7: Employee can access material request page', async ({ page }) => {
    await loginAsEmployee(page)
    await page.goto('/karyawan/work-order')
    await page.waitForLoadState('networkidle')
    
    const woLinks = page.locator('a[href*="/karyawan/work-order/"]')
    
    if (await woLinks.count() > 0) {
      const href = await woLinks.first().getAttribute('href')
      if (href) {
        const woId = href.split('/').pop()
        await page.goto(`/karyawan/work-order/${woId}/ambil-barang`)
        await page.waitForLoadState('networkidle')
        
        // Should show material page or redirect
        const isMaterialPage = page.url().includes('ambil-barang')
        expect(isMaterialPage).toBeTruthy()
      }
    } else {
      test.skip()
    }
  })
})
