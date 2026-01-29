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

test.describe('Barang Masuk (Add Stock)', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginAsAdmin(page)
    expect(loggedIn, 'Login failed').toBeTruthy()
  })

  test('should be able to add stock using direct API', async ({ page }) => {
    test.setTimeout(60000)

    console.log('Step 1: Navigate to Barang Masuk page')
    await page.goto('/admin/inventory/masuk')
    await page.waitForLoadState('domcontentloaded')
    
    // Verify page loaded
    await expect(page.locator('h1')).toContainText('Barang Masuk')
    console.log('✓ Barang Masuk page loaded')

    // Check if table or empty state is visible
    const tableVisible = await page.locator('table').isVisible().catch(() => false)
    const emptyStateVisible = await page.locator('text=Tidak ada data').isVisible().catch(() => false)
    
    expect(tableVisible || emptyStateVisible).toBeTruthy()
    console.log('✓ Barang Masuk table/empty state is visible')

    // Test via API instead of UI
    console.log('Step 2: Testing Barang Masuk API')
    
    // Get first available barang
    const barangResponse = await page.request.get('/api/inventory/barang?limit=1')
    expect(barangResponse.ok()).toBeTruthy()
    const barangData = await barangResponse.json()
    
    if (!barangData.barangs || barangData.barangs.length === 0) {
      console.log('No barang found, skipping stock test')
      return
    }

    const firstBarang = barangData.barangs[0]
    console.log(`Using barang: ${firstBarang.nama} (${firstBarang.kode})`)

    // Get first available gudang
    const gudangResponse = await page.request.get('/api/inventory/gudang')
    expect(gudangResponse.ok()).toBeTruthy()
    const gudangData = await gudangResponse.json()
    
    if (!gudangData.length) {
      console.log('No gudang found, skipping stock test')
      return
    }

    const firstGudang = gudangData[0]
    console.log(`Using gudang: ${firstGudang.nama}`)

    // Add stock via API
    const addStockResponse = await page.request.post('/api/inventory/masuk', {
      data: {
        barangId: firstBarang.id,
        gudangId: firstGudang.id,
        jumlah: 10,
        kondisi: 'BARU',
        keterangan: 'Test stock from automated test',
        tanggal: new Date().toISOString()
      }
    })

    expect(addStockResponse.ok()).toBeTruthy()
    const addStockData = await addStockResponse.json()
    console.log('✓ Stock added successfully via API')
    console.log(`Added ${addStockData.jumlah} units of ${firstBarang.nama}`)

    // Verify stock was added by checking the list
    await page.goto('/admin/inventory/masuk')
    await page.waitForLoadState('networkidle')
    
    // Should see the newly added stock in the table
    const tableContent = await page.locator('table').textContent().catch(() => '')
    expect(tableContent).toContain(firstBarang.nama)
    console.log('✓ Stock appears in Barang Masuk table')
  })

  test('should display Barang Masuk form button', async ({ page }) => {
    await page.goto('/admin/inventory/masuk')
    await page.waitForLoadState('domcontentloaded')
    
    // Check if "Barang Masuk" button exists
    const addButton = page.locator('button:has-text("Barang Masuk")')
    await expect(addButton).toBeVisible({ timeout: 10000 })
    console.log('✓ "Barang Masuk" button is visible')
  })
})
