
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
    const targetDay = 29
    const today = new Date()
    const dateStr = `${today.getFullYear()}-12-${targetDay}`

    console.log(`Creating holiday: ${holidayName} on ${dateStr}`)
    await page.goto('/admin/kehadiran/holidays')
    await page.waitForLoadState('domcontentloaded')

    const daySelector = `span:text-is("${targetDay}")`
    const dayCell = page.locator('.group').filter({ has: page.locator(daySelector) }).first()
    
    page.on('dialog', async dialog => {
      await dialog.accept()
    })

    await dayCell.click()
    await expect(page.locator('h2, h3').filter({ hasText: /Hari Libur/ })).toBeVisible()
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
    await expect(page.locator('text=Memuat data...')).not.toBeVisible()
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
    await expect(page.locator('text=Memuat data...')).not.toBeVisible()
  })

  test('should verify Izin & Cuti and Manual Input modal', async ({ page }) => {
    await page.goto('/admin/kehadiran/izin')
    await expect(page.locator('h1')).toContainText('Manajemen Izin & Cuti')
    await page.waitForLoadState('domcontentloaded')

    await page.click('button:has-text("Input Manual")')
    await expect(page.locator('h3:has-text("Input Manual Izin/Cuti")')).toBeVisible()
    
    await page.click('button:has-text("Batal")')
    await expect(page.locator('h3:has-text("Input Manual Izin/Cuti")')).not.toBeVisible()
  })
})
