
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

test.describe('Finance Management E2E', () => {
  let expenseDesc: string
  
  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginAsAdmin(page)
    expect(loggedIn, 'Login failed').toBeTruthy()
    expenseDesc = `Expense-${Date.now()}`
  })

  test('should manage expenses (Three-Step Flow)', async ({ page }) => {
    test.setTimeout(120000)

    // 1. Go to Expenses Page
    console.log('Navigating to Finance Pengeluaran...')
    await page.goto('/admin/finance/pengeluaran')
    
    // 2. Open Create Modal
    console.log('Opening "Tambah Pengeluaran" modal...')
    await page.click('button:has-text("Tambah Pengeluaran")')
    
    // --- STEP 1: Detail ---
    console.log('Step 1: Filling details')
    await page.locator('input[type="number"]').first().fill('50000') // Nominal
    await page.fill('textarea', expenseDesc) // Description
    
    // Click "Lanjut" (Step 1 -> 2)
    await page.click('button:has-text("Lanjut")')
    
    // --- STEP 2: Klasifikasi ---
    console.log('Step 2: Selecting category and account')
    
    // Select Category (Combobox)
    console.log('Selecting category...')
    await page.click('text=Pilih kategori beban...')
    await page.fill('input[placeholder="Cari..."]', 'Beban Gaji')
    await page.waitForTimeout(500)
    await page.click('button:has-text("Beban Gaji")')
    
    // Select Account (Combobox)
    console.log('Selecting account...')
    await page.click('text=Pilih sumber dana...')
    await page.fill('input[placeholder="Cari..."]', 'Kas Operasional')
    await page.waitForTimeout(500)
    await page.click('button:has-text("Kas Operasional")')
    
    // Click "Lanjut" (Step 2 -> 3)
    await page.click('button:has-text("Lanjut")')
    
    // --- STEP 3: Konfirmasi ---
    console.log('Step 3: Confirming transaction')
    await expect(page.locator('text=Konfirmasi & Bukti')).toBeVisible()
    
    // Submit
    console.log('Submitting...')
    await page.click('button:has-text("Simpan Transaksi")')
    
    // 3. Verify Success & Audit Log
    console.log('Verifying success...')
    await expect(page.locator('text=Pengeluaran berhasil dicatat')).toBeVisible({ timeout: 15000 })
    
    await page.goto('/admin/log/activity')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toContainText('CREATE')
    await expect(page.locator('table')).toContainText('Finance Pengeluaran')
    console.log('Audit log verified.')
  })
})
