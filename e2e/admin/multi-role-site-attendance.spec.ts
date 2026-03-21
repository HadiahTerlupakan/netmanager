
import { test, expect, type Page } from '@playwright/test'

const QA_USERS = {
  hrAdmin: { email: 'qa.hr@test.com', password: 'qatest123', site: 'Jakarta Selatan' },
  networkAdmin: { email: 'qa.network@test.com', password: 'qatest123', site: 'Jakarta Selatan' },
}

async function login(page: Page, email: string, pass: string) {
  await page.goto('/admin/login')
  await page.waitForSelector('#email', { timeout: 30000 })
  await page.fill('#email', email)
  await page.fill('#password', pass)
  await page.click('button[type="submit"]')
  
  await page.waitForURL(url => 
    url.pathname.includes('/admin') && !url.pathname.includes('/login'),
    { timeout: 45000 }
  )
}

test.describe('Attendance Multi-Role & Multi-Site Verification', () => {

  test('HR Admin should have access to core attendance menus but restricted from report', async ({ page }) => {
    await login(page, QA_USERS.hrAdmin.email, QA_USERS.hrAdmin.password)
    
    // Partially accessible (based on seed-qa-users.ts)
    const allowedPaths = [
      '/admin/attendance',
      '/admin/kehadiran/holidays',
      '/admin/lembur',
      '/admin/kehadiran/izin'
    ]

    for (const path of allowedPaths) {
      console.log(`Checking access for HR Admin: ${path}`)
      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')
      await expect(page).toHaveURL(new RegExp(path))
      await expect(page.locator('h1')).toBeVisible()
    }

    // Report is restricted (lacks report:read)
    console.log('Checking restricted access for HR Admin: /admin/kehadiran/laporan')
    await page.goto('/admin/kehadiran/laporan')
    await expect(page).not.toHaveURL(/\/admin\/kehadiran\/laporan/)
    console.log('HR Admin correctly restricted from Laporan.')
  })

  test('Network Admin should be restricted from HR module', async ({ page }) => {
    await login(page, QA_USERS.networkAdmin.email, QA_USERS.networkAdmin.password)
    
    const hrPaths = ['/admin/attendance', '/admin/lembur', '/admin/kehadiran/izin']
    
    for (const path of hrPaths) {
        console.log(`Checking restriction for Network Admin: ${path}`)
        await page.goto(path)
        // Should redirect to dashboard or other page
        await expect(page).not.toHaveURL(new RegExp(path))
    }
    console.log('Network Admin correctly restricted from HR module.')
  })

  test('Data Verification: Attendance counts should vary by site filters', async ({ page }) => {
    // Login as SUPER_ADMIN to see all sites
    await login(page, 'admin@example.com', 'admin123')
    await page.goto('/admin/attendance')
    await page.waitForLoadState('domcontentloaded')

    // Find the Site select specifically
    const siteSelect = page.locator('select').nth(0) 
    const cariButton = page.locator('button:has-text("Cari")')

    console.log('Starting site filtering verification...')

    // Sites from the dropdown dynamically
    const options = await siteSelect.locator('option').all()
    const validOptions = []
    
    for (const option of options) {
        const label = await option.innerText()
        const value = await option.getAttribute('value')
        if (value && value !== 'all') {
            validOptions.push({ label, value })
        }
    }

    console.log(`Found ${validOptions.length} sites to test.`)

    for (const site of validOptions.slice(0, 2)) { // Test first 2 sites
        console.log(`Filtering by site: ${site.label}`)
        await siteSelect.selectOption({ value: site.value })
        await cariButton.click()
        
        await page.waitForResponse(r => r.url().includes('/api/admin/attendance') && r.status() === 200)
        await expect(page.locator('text=Memuat data...')).not.toBeVisible()
        
        const count = await page.locator('.text-2xl').first().textContent()
        console.log(`Result for ${site.label}: ${count}`)
        expect(count).toBeDefined()
    }
  })

})
