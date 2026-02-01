
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

test.describe('Leave Management (Manajemen Izin & Cuti)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/kehadiran/izin')
    await expect(page.locator('h1')).toContainText('Manajemen Izin & Cuti')
  })

  test('should validate manual input form', async ({ page }) => {
    await page.click('button:has-text("Input Manual")')
    await expect(page.locator('h2:has-text("Input Izin Manual")')).toBeVisible()

    // Submit empty form
    await page.click('button:has-text("Simpan Data")')
    // Expect toast error (checking for toast presence usually implies checking for a specific class or text)
    // Assuming toast library renders a div with text
    await expect(page.getByText('Mohon lengkapi semua field')).toBeVisible()

    // Test invalid date range (End < Start)
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Select a user (assuming there is at least one user in the dropdown)
    await page.fill('input[placeholder="Ketik nama karyawan..."]', 'a') // Type something to trigger search
    // Wait for dropdown
    await page.waitForSelector('.absolute.z-10')
    // Click first user
    await page.click('.absolute.z-10 > div:first-child')

    // Fill dates
    await page.locator('input[type="date"]').first().fill(today) // Start Date
    await page.locator('input[type="date"]').last().fill(yesterday) // End Date (Invalid)
    await page.fill('textarea', 'Test Reason')

    await page.click('button:has-text("Simpan Data")')
    await expect(page.getByText('Tanggal selesai harus setelah atau sama dengan tanggal mulai')).toBeVisible()
  })

  test('should create, verify, and delete a leave request', async ({ page }) => {
    // 1. Create Leave
    await page.click('button:has-text("Input Manual")')

    // Wait for the modal to fully appear
    await expect(page.locator('h2:has-text("Input Izin Manual")')).toBeVisible()

    // Select user - Search for the current logged in admin user usually 'Super Admin' or just 'Admin'
    // We'll type 'Admin' to be specific
    await page.fill('input[placeholder="Ketik nama karyawan..."]', 'Admin')

    // Wait for the dropdown to appear and have at least one item
    const dropdownItem = page.locator('.absolute.z-10 > div').first()
    await dropdownItem.waitFor({ state: 'visible', timeout: 5000 })

    // Click the first user in the dropdown
    await dropdownItem.click()

    // Verify user is selected (green checkmark should appear based on IzinClient logic)
    await expect(page.locator('text=Karyawan terpilih')).toBeVisible()

    // Fill details
    const today = new Date().toISOString().split('T')[0]
    await page.locator('input[type="date"]').first().fill(today)
    await page.locator('input[type="date"]').last().fill(today)
    await page.selectOption('select', 'IZIN') // Select 'Izin' type
    const reason = `Test Leave E2E ${Date.now()}`
    await page.fill('textarea', reason)

    // Submit with network wait
    const responsePromise = page.waitForResponse(response =>
      response.url().includes('/api/admin/leaves') && response.request().method() === 'POST'
    );

    await page.click('button:has-text("Simpan Data")')

    try {
        const response = await responsePromise;
        console.log(`Create Leave Response status: ${response.status()}`);
        if (!response.ok()) {
             console.log('Response body:', await response.json());
        }
    } catch (e) {
        console.log('Wait for response timed out or failed. Checking for validation errors...');
    }

    // Check for validation error toast if submission failed
    const errorToast = page.getByText('Mohon lengkapi semua field');
    if (await errorToast.isVisible()) {
        throw new Error('Form submission failed validation');
    }

    // Verify success toast
    await expect(page.getByText('Pengajuan manual berhasil dibuat')).toBeVisible()

    // Modal should close
    await expect(page.locator('h2:has-text("Input Izin Manual")')).not.toBeVisible()

    // 2. Verify in Table
    // Filter to 'Disetujui' since admin manual input is auto-approved
    await page.click('button:has-text("Disetujui")')
    // Use .first() to handle potential duplicates in table view (mobile/desktop responsive)
    await expect(page.getByText(reason).first()).toBeVisible()

    // 3. View Detail
    await page.click(`button:has-text("Detail") >> nth=0`)
    // Need to find the row with our reason to be precise, but for now assuming it's at top due to sorting

    // Verify Detail Modal
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(reason)).toBeVisible();
    await expect(modal.getByText('Disetujui')).toBeVisible();

    // 4. Delete
    // Ensure delete button is visible (it might be in the footer now)

    // Handle native confirm dialog BEFORE clicking
    page.on('dialog', dialog => dialog.accept());

    await modal.getByRole('button', { name: 'Hapus' }).click();

    // Verify deletion
    await expect(page.getByText('Pengajuan berhasil dihapus')).toBeVisible()
    await expect(page.getByText(reason)).not.toBeVisible()
  })
})
