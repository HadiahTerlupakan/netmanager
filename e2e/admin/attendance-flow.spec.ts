
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
    
    await page.waitForFunction(
      () => !window.location.pathname.includes('login'),
      { timeout: 20000 }
    )
    await page.waitForLoadState('domcontentloaded')
    return true
  } catch (error) {
    console.error('Login failed:', error)
    return false
  }
}

test.describe('Attendance Module Business Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should navigate through all attendance submenus', async ({ page }) => {
    const submenus = [
      { name: 'Laporan', path: '/admin/kehadiran/laporan' },
      { name: 'Data Absensi', path: '/admin/attendance' },
      { name: 'Hari Libur', path: '/admin/kehadiran/holidays' },
      { name: 'Manajemen Lembur', path: '/admin/lembur' },
      { name: 'Izin & Cuti', path: '/admin/kehadiran/izin' }
    ]

    for (const menu of submenus) {
      console.log(`Navigating to: ${menu.name}`)
      await page.goto(menu.path)
      await expect(page).toHaveURL(new RegExp(menu.path))
      await expect(page.locator('h1')).toContainText(new RegExp(menu.name, 'i'), { timeout: 10000 })
    }
  })

  test('should manage holidays (Create -> Verify -> Delete)', async ({ page }) => {
    const holidayName = `LiburTest${Date.now()}`
    const targetDay = 15
    const today = new Date()
    // Use current year and month for the date string
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const dateStr = `${today.getFullYear()}-${month}-${targetDay}`

    console.log(`Creating holiday: ${holidayName} on ${dateStr}`)
    await page.goto('/admin/kehadiran/holidays')

    console.log('Waiting for calendar grid...')
    await page.locator('.grid').first().waitFor({ state: 'visible' })

    // Find the cell that contains the day number (exact match)
    // The grid we want is the one with auto-rows-fr (the calendar days)
    console.log(`Looking for day cell with text: ${targetDay}`)

    // We look for the span containing the day number, then go to its parent div which has the click handler
    const dayNumberSpan = page.locator('.grid span').filter({ hasText: new RegExp(`^${targetDay}$`) }).last()
    const dayCell = dayNumberSpan.locator('..').locator('..') // span -> div (flex) -> div (cell with onClick)

    // Ensure it's visible before clicking
    console.log('Scrolling to day cell...')
    await dayNumberSpan.scrollIntoViewIfNeeded();
    console.log('Clicking day cell...')
    await dayCell.click({ force: true });

    console.log('Waiting for holiday modal...')
    const modalHeader = page.locator('h2, h3').filter({ hasText: /Hari Libur/i })
    await expect(modalHeader).toBeVisible({ timeout: 10000 })

    console.log('Filling holiday form...')
    await page.fill('input[type="date"]', dateStr)
    await page.fill('input[placeholder*="Contoh: Tahun Baru"]', holidayName)
    await page.click('button:has-text("Simpan")')

    console.log('Verifying holiday in calendar...')
    const holidayBadge = page.locator(`div:has-text("${holidayName}")`).first()
    await expect(holidayBadge).toBeVisible({ timeout: 15000 })

    console.log('Deleting holiday...')
    await holidayBadge.hover()
    const deleteButton = page.locator('.group').filter({ has: holidayBadge }).locator('button[title="Hapus"]')
    await deleteButton.click()
    
    await expect(holidayBadge).not.toBeVisible()
  })

  test('should verify Data Absensi and filters', async ({ page }) => {
    await page.goto('/admin/attendance')
    await expect(page.locator('h1')).toContainText('Data Absensi')
    await page.waitForLoadState('domcontentloaded')

    const siteSelect = page.locator('select').nth(0)
    const cariButton = page.locator('button:has-text("Cari")')

    await expect(async () => {
      const count = await siteSelect.locator('option').count()
      expect(count).toBeGreaterThan(1)
    }).toPass({ timeout: 10000 })
    
    await siteSelect.selectOption({ index: 1 })
    await cariButton.click()
    
    await expect(page.locator('table')).toBeVisible()
    // Use first() to avoid strict mode violation if multiple loading indicators are present (e.g. one for table, one for something else)
    await expect(page.locator('text=Memuat data...').first()).not.toBeVisible()
  })

  test('should verify Lembur Management and status filters', async ({ page }) => {
    await page.goto('/admin/lembur')
    await expect(page.locator('h1')).toContainText('Manajemen Lembur')
    await page.waitForLoadState('domcontentloaded')

    const statusSelect = page.locator('select').nth(2)
    const cariButton = page.locator('button:has-text("Cari")')

    await expect(statusSelect.locator('option[value="PENDING"]')).toBeAttached()
    await statusSelect.selectOption('PENDING')
    await cariButton.click()

    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('text=Memuat data...').first()).not.toBeVisible()
  })

  test('should verify Izin & Cuti and Manual Input modal', async ({ page }) => {
    await page.goto('/admin/kehadiran/izin')
    await expect(page.locator('h1')).toContainText('Manajemen Izin & Cuti')
    await page.waitForLoadState('domcontentloaded')

    await page.click('button:has-text("Input Manual")')
    // Updated title to match actual UI observed in other tests
    await expect(page.locator('h3:has-text("Input Izin Manual")')).toBeVisible()

    await page.click('button:has-text("Batal")')
    await expect(page.locator('h3:has-text("Input Izin Manual")')).not.toBeVisible()
  })
})
