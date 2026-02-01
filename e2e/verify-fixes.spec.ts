import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './utils/auth';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASS = 'admin123';

test.describe('Verification of Bug Fixes', () => {

  test.beforeEach(async ({ page }) => {
    // Use robust login helper
    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASS);
  });

  test('TC001-Fix: Radius Sync should not crash', async ({ page }) => {
    // Navigate to Radius page
    await page.goto('http://localhost:3000/admin/network/radius');

    // Find Sync button (Sync All Users)
    const syncBtn = page.locator('button').filter({ hasText: 'Sync All Users' }).first();
    // Wait for button instead of H1 which might be generic "NetManager"
    await expect(syncBtn).toBeVisible({ timeout: 15000 });
    await syncBtn.click();

    // In the modal, click "Start Sync"
    const startSyncBtn = page.locator('button').filter({ hasText: 'Start Sync' }).first();
    await expect(startSyncBtn).toBeVisible();
    await startSyncBtn.click();

    // Expect Success Toast
    await expect(page.getByText(/Sync Complete!|Sync Finished/i)).toBeVisible({ timeout: 15000 });
  });

  test('TC007-Fix: Shift Creation should work with unique code', async ({ page }) => {
    // Correct URL for Shift Management
    await page.goto('http://localhost:3000/admin/kehadiran/shift');

    // Open Add Modal
    console.log('Clicking Tambah Shift button...');
    const addBtn = page.locator('button').filter({ hasText: 'Tambah Shift' }).first();
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await addBtn.click();

    // Wait for Modal
    console.log('Waiting for Shift modal...');
    const modalHeader = page.locator('h2').filter({ hasText: /Tambah Shift|Create Shift/i });
    await expect(modalHeader).toBeVisible();

    const uniqueCode = `S-${Date.now().toString().slice(-4)}`;

    // Fill form
    console.log(`Filling shift form with code: ${uniqueCode}`);
    await page.getByPlaceholder('contoh: Pagi').fill(`Shift Test ${uniqueCode}`);
    await page.getByPlaceholder('contoh: S1').fill(uniqueCode);
    await page.locator('input[type="time"]').nth(0).fill('08:00');
    await page.locator('input[type="time"]').nth(1).fill('17:00');

    // Save
    console.log('Clicking Simpan...');
    await page.locator('button').filter({ hasText: 'Simpan' }).first().click();

    // Verify success
    await expect(page.getByText(/berhasil dibuat/i)).toBeVisible();

    // Verify in table
    await expect(page.getByText(uniqueCode)).toBeVisible();
  });

  test('TC018-Fix: APK Upload should work', async ({ page }) => {
    // Correct URL for App Version
    await page.goto('http://localhost:3000/admin/pengaturan/app-version');

    // Open Upload Modal
    console.log('Clicking Upload Versi Baru button...');
    const uploadBtn = page.locator('button').filter({ hasText: 'Upload Versi Baru' }).first();
    await expect(uploadBtn).toBeVisible({ timeout: 15000 });
    await uploadBtn.click();

    // Wait for Modal
    console.log('Waiting for Upload modal...');
    const modalHeader = page.locator('h2').filter({ hasText: /Upload Versi Baru|Upload New Version/i });
    await expect(modalHeader).toBeVisible();

    // Fill form
    const uniqueVer = `1.0.${Date.now().toString().slice(-3)}`;
    console.log(`Filling APK form with version: ${uniqueVer}`);
    await page.getByPlaceholder('1.0.54').fill(uniqueVer);
    await page.getByPlaceholder('47').first().fill('100');
    await page.getByPlaceholder('47').last().fill('100');

    // Handle File Upload
    const filePath = '/tmp/test-app-1.0.55.apk';
    console.log(`Uploading file: ${filePath}`);

    // Find file input. It might be hidden or styled.
    await page.setInputFiles('input[type="file"]', filePath);

    // Submit
    console.log('Clicking Submit...');
    await page.locator('button[type="submit"]').first().click();

    // Verify success (timeout increased for upload)
    console.log('Waiting for success toast (up to 30s)...');
    await expect(page.getByText(/berhasil diupload/i)).toBeVisible({ timeout: 30000 });

    // Verify in list
    await expect(page.getByText(uniqueVer)).toBeVisible();
  });

});
