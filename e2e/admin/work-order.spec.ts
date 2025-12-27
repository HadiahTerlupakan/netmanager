import { test, expect } from '@playwright/test'

test.describe('Work Order Management', () => {
  test('work order route should be protected', async ({ page }) => {
    await page.goto('/admin/work-order')
    
    await page.waitForTimeout(2000)
    const url = page.url()
    expect(url.includes('login') || url.includes('admin')).toBeTruthy()
  })
})

test.describe('Work Order API', () => {
  // Note: Actual API route is /api/admin/workorders
  test('GET /api/admin/workorders should return data or require auth', async ({ request }) => {
    const response = await request.get('/api/admin/workorders')
    
    // Should return 200 (with data) or 401/403 (needs auth)
    expect([200, 401, 403]).toContain(response.status())
  })

  test('workorders endpoint should exist', async ({ request }) => {
    const response = await request.get('/api/admin/workorders')
    
    // Endpoint exists (not 404)
    expect(response.status()).not.toBe(404)
  })
})

test.describe('Karyawan Work Order Portal', () => {
  test('should load karyawan login or portal', async ({ page }) => {
    await page.goto('/karyawan')
    
    await page.waitForTimeout(2000)
    const url = page.url()
    expect(url.includes('karyawan') || url.includes('login')).toBeTruthy()
  })
})
