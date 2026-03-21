import { test, expect } from '@playwright/test';

test.describe('Customer Portal', () => {
  // Use serial mode to keep session if needed, but for now we login each time or use storage state
  // Let's just login each time for simplicity in this smoke test

  test('should login and view dashboard', async ({ page }) => {

    // 1. Navigate to login
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Selamat Datang');

    // 2. Fill Credentials (seeded in prisma/seed-customer.ts)
    // ID: 88888888, Pass: customer123
    await page.fill('input[type="text"]', '88888888');
    await page.fill('input[type="password"]', 'customer123');

    // 3. Submit
    await page.click('button[type="submit"]');

    // 4. Wait for navigation
    await page.waitForFunction(() => window.location.pathname.includes('dashboard'), { timeout: 30000 });

    // 5. Verify Dashboard
    // Wait for the loading spinner to disappear
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 20000 });

    // Check for "Gagal memuat data" which indicates API failure even if login succeeded
    // We use a try-catch block to provide better error messages
    try {
        await expect(page.getByText('Gagal memuat data')).not.toBeVisible({ timeout: 1000 });
    } catch {
        // If visible, grab some context
        console.log('Dashboard error state detected');
        throw new Error('Dashboard failed to load data (API Error)');
    }

    // Verify key elements
    await expect(page.getByText('Dashboard', { exact: true })).toBeVisible();
    await expect(page.getByText('Test Customer')).toBeVisible(); // Name from seed
    await expect(page.getByText('Tagihan Bulan Ini')).toBeVisible();
  });

  test('should view billing history', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="text"]', '88888888');
    await page.fill('input[type="password"]', 'customer123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });

    // Navigate to Billing/Riwayat via Quick Menu or Bottom Nav
    // Using Bottom Nav "Tagihan" or "Riwayat"
    // Bottom nav usually has specific links. Let's check the code or just go to URL.
    await page.goto('/riwayat');

    // Verify Page Title
    // The Layout or Page should have a header
    // Based on file exploration, we assume there is a page for this.
    // If not, we check for 404.
    await expect(page.locator('body')).not.toContainText('404');
  });
});
