import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASS = 'admin123';

test.describe('Verification of Bug Fixes', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Login as Admin
    await page.goto('http://localhost:3000/admin/login');
    await page.fill('input[type="text"], input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');

    // Wait for dashboard or redirection
    await expect(page).toHaveURL(/.*admin.*/, { timeout: 10000 });
  });

  test('TC001-Fix: Radius Sync should not crash', async ({ page }) => {
    // Navigate to Radius page
    await page.goto('http://localhost:3000/admin/network/radius');

    // Find Sync button (Sync All Users)
    // Note: Based on code, it's a button with text "Sync All Users" or icon
    const syncBtn = page.getByRole('button', { name: /Sync All Users/i });
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();

    // In the modal, click "Start Sync"
    const startSyncBtn = page.getByRole('button', { name: /Start Sync/i });
    await expect(startSyncBtn).toBeVisible();
    await startSyncBtn.click();

    // Expect Success Toast
    // The previous error was a crash. We expect a success message now.
    await expect(page.getByText(/Sync Complete!/i)).toBeVisible({ timeout: 15000 });
  });

  test('TC007-Fix: Shift Creation should work with unique code', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/shifts');

    // Open Add Modal
    await page.getByRole('button', { name: /Tambah Shift/i }).click();

    // Generate unique code
    const uniqueCode = `S-${Date.now().toString().slice(-4)}`;

    // Fill form
    await page.fill('input[name="name"]', `Shift Test ${uniqueCode}`);
    await page.fill('input[name="code"]', uniqueCode);
    await page.fill('input[name="startTime"]', '08:00');
    await page.fill('input[name="endTime"]', '17:00');

    // Save
    await page.getByRole('button', { name: /Simpan/i }).click();

    // Verify success
    await expect(page.getByText(/berhasil dibuat/i)).toBeVisible();

    // Verify in table
    await expect(page.getByText(uniqueCode)).toBeVisible();
  });

  test('TC018-Fix: APK Upload should work', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/app-version');

    // Open Upload Modal
    await page.getByRole('button', { name: /Upload Versi Baru/i }).click();

    // Fill form
    const uniqueVer = `1.0.${Date.now().toString().slice(-3)}`;
    await page.fill('input[name="version"]', uniqueVer);
    await page.fill('input[name="buildNumber"]', '100');
    await page.fill('input[name="versionCode"]', '100');

    // Handle File Upload
    // We created /tmp/test-app-1.0.55.apk earlier
    // Note: Playwright needs the file to be accessible
    const filePath = '/tmp/test-app-1.0.55.apk';

    // Find file input. It might be hidden or styled.
    // Try generic input[type=file]
    await page.setInputFiles('input[type="file"]', filePath);

    // Submit
    await page.getByRole('button', { name: /Upload/i, exact: true }).click();

    // Verify success (timeout increased for upload)
    await expect(page.getByText(/berhasil diupload/i)).toBeVisible({ timeout: 30000 });

    // Verify in list
    await expect(page.getByText(uniqueVer)).toBeVisible();
  });

});
