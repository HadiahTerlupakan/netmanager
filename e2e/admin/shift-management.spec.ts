
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

test.describe('Shift Management', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging from the page
    page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));

    // Force desktop viewport to ensure Table view is rendered
    await page.setViewportSize({ width: 1280, height: 720 })
    await loginAsAdmin(page)
    await page.goto('/admin/kehadiran/shift')
    await expect(page.locator('h1')).toContainText('Manajemen Shift')
  })

  test('should validate shift form', async ({ page }) => {
    await page.click('button:has-text("Tambah Shift")')
    await expect(page.locator('h2:has-text("Tambah Shift Baru")')).toBeVisible()

    // Test invalid time range (Start > End)
    await page.fill('input[placeholder="Pagi"]', 'Invalid Shift')
    await page.fill('input[type="time"] >> nth=0', '17:00') // Start Time
    await page.fill('input[type="time"] >> nth=1', '08:00') // End Time

    await page.click('button:has-text("Simpan")')

    // Expect toast error or validation message
    await expect(page.getByText('Jam Pulang harus lebih besar dari Jam Masuk')).toBeVisible()
  })

  test('should create, edit, and delete a shift', async ({ page }) => {
    const shiftName = `Shift Test ${Date.now()}`
    const shiftCode = `S${Math.floor(Math.random() * 1000)}`

    // 1. Create Shift
    await page.click('button:has-text("Tambah Shift")')
    await page.fill('input[placeholder="Pagi"]', shiftName)
    await page.fill('input[placeholder="S1"]', shiftCode)
    await page.fill('input[type="time"] >> nth=0', '09:00')
    await page.fill('input[type="time"] >> nth=1', '18:00')
    await page.fill('textarea', 'Test Description')

    // Wait for the create request AND the subsequent refresh
    const createResponsePromise = page.waitForResponse(response =>
      response.url().includes('/api/admin/shifts') && response.request().method() === 'POST'
    )
    const refreshResponsePromise = page.waitForResponse(response =>
      response.url().includes('/api/admin/shifts') && response.request().method() === 'GET'
    )

    await page.click('button:has-text("Simpan")')

    await createResponsePromise
    await refreshResponsePromise

    await expect(page.getByText('Shift berhasil dibuat')).toBeVisible()

    // Wait for loading to finish
    await expect(page.getByText('Memuat data...')).not.toBeVisible()

    // Verify it appears in the list using cell locator
    // ResponsiveTable uses standard table elements on desktop
    const shiftCell = page.getByRole('cell', { name: shiftName }).first()
    await expect(shiftCell).toBeVisible()

    // 2. Edit Shift
    // Find the row containing the shift name.
    const row = page.getByRole('row').filter({ has: shiftCell }).first()
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: 'Edit' }).click()

    await expect(page.locator('h2:has-text("Edit Shift")')).toBeVisible()
    await page.fill('input[placeholder="Pagi"]', `${shiftName} Updated`)

    const updateResponsePromise = page.waitForResponse(response =>
      response.url().includes('/api/admin/shifts') && response.request().method() === 'PATCH'
    )
    const refreshResponsePromise2 = page.waitForResponse(response =>
      response.url().includes('/api/admin/shifts') && response.request().method() === 'GET'
    )

    await page.click('button:has-text("Simpan")')

    await updateResponsePromise
    await refreshResponsePromise2

    await expect(page.getByText('Shift berhasil diperbarui')).toBeVisible()
    await expect(page.getByText('Memuat data...')).not.toBeVisible()

    // Verify the updated text is visible
    const updatedShiftCell = page.getByRole('cell', { name: `${shiftName} Updated` }).first()
    await expect(updatedShiftCell).toBeVisible()

    // 3. Delete Shift
    const deleteRow = page.getByRole('row').filter({ has: updatedShiftCell }).first()
    await expect(deleteRow).toBeVisible()

    // Setup dialog listener before clicking
    page.once('dialog', dialog => dialog.accept())

    const deleteResponsePromise = page.waitForResponse(response =>
        response.url().includes('/api/admin/shifts') && response.request().method() === 'DELETE'
    )
    const refreshResponsePromise3 = page.waitForResponse(response =>
        response.url().includes('/api/admin/shifts') && response.request().method() === 'GET'
    )

    await deleteRow.getByRole('button', { name: 'Hapus' }).click()

    await deleteResponsePromise
    await refreshResponsePromise3

    await expect(page.getByText('Shift berhasil dihapus')).toBeVisible()
    await expect(page.getByText(`${shiftName} Updated`)).not.toBeVisible()
  })

  test('should allow reusing code after soft delete', async ({ page }) => {
    const shiftName = `Shift Reuse ${Date.now()}`
    const shiftCode = `R${Math.floor(Math.random() * 1000)}`

    // 1. Create Shift
    await page.click('button:has-text("Tambah Shift")')
    await page.fill('input[placeholder="Pagi"]', shiftName)
    await page.fill('input[placeholder="S1"]', shiftCode)
    await page.fill('input[type="time"] >> nth=0', '09:00')
    await page.fill('input[type="time"] >> nth=1', '17:00')

    const createPromise1 = page.waitForResponse(response =>
      response.url().includes('/api/admin/shifts') && response.request().method() === 'POST'
    )
    const refreshPromise1 = page.waitForResponse(response =>
        response.url().includes('/api/admin/shifts') && response.request().method() === 'GET'
    )

    await page.click('button:has-text("Simpan")')
    await createPromise1
    await refreshPromise1

    await expect(page.getByText('Shift berhasil dibuat')).toBeVisible()
    await expect(page.getByText('Memuat data...')).not.toBeVisible()

    const shiftCell = page.getByRole('cell', { name: shiftName }).first()
    await expect(shiftCell).toBeVisible()

    // 2. Delete Shift
    const deleteRow = page.getByRole('row').filter({ has: shiftCell }).first()
    await expect(deleteRow).toBeVisible()

    page.once('dialog', dialog => dialog.accept())

    const deletePromise = page.waitForResponse(response =>
        response.url().includes('/api/admin/shifts') && response.request().method() === 'DELETE'
    )
    const refreshPromise2 = page.waitForResponse(response =>
        response.url().includes('/api/admin/shifts') && response.request().method() === 'GET'
    )

    await deleteRow.getByRole('button', { name: 'Hapus' }).click()
    await deletePromise
    await refreshPromise2

    await expect(page.getByText('Shift berhasil dihapus')).toBeVisible()
    await expect(page.getByText(shiftName)).not.toBeVisible() // Should be hidden or marked inactive depending on filter

    // 3. Create Shift with SAME Code
    await page.click('button:has-text("Tambah Shift")')
    await page.fill('input[placeholder="Pagi"]', `${shiftName} Recreated`)
    await page.fill('input[placeholder="S1"]', shiftCode) // Same code
    await page.fill('input[type="time"] >> nth=0', '09:00')
    await page.fill('input[type="time"] >> nth=1', '17:00')

    const createPromise2 = page.waitForResponse(response =>
        response.url().includes('/api/admin/shifts') && response.request().method() === 'POST'
    )
    const refreshPromise3 = page.waitForResponse(response =>
        response.url().includes('/api/admin/shifts') && response.request().method() === 'GET'
    )

    await page.click('button:has-text("Simpan")')

    try {
        const response2 = await createPromise2
        if (!response2.ok()) {
            console.log('Re-create Shift Error Body:', await response2.text())
        }
        await refreshPromise3
    } catch(e) {
        console.log('Timeout waiting for re-create response')
    }

    await expect(page.getByText('Shift berhasil dibuat').first()).toBeVisible()
    await expect(page.getByText(`${shiftName} Recreated`).first()).toBeVisible()
  })
})
