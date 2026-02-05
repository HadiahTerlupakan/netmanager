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
    await page.getByPlaceholder('Pagi').fill(`Shift Test ${uniqueCode}`);
    await page.getByPlaceholder('S1').fill(uniqueCode);
    await page.locator('input[type="time"]').nth(0).fill('08:00');
    await page.locator('input[type="time"]').nth(1).fill('17:00');

    // Save
    console.log('Clicking Simpan...');
    await page.locator('button').filter({ hasText: 'Simpan' }).first().click();

    // Verify success
    await expect(page.getByText(/berhasil dibuat/i)).toBeVisible();

    // Verify in table - use first() to handle potential duplicates (mobile view/multiple columns)
    await expect(page.locator('table').getByText(uniqueCode).first()).toBeVisible();
  });

  test('TC018-Fix: APK Upload should work', async ({ page }) => {
    const mockUploadUrl = 'http://localhost:3000/mock-upload';
    const mockKey = 'mock-key-123';

    // MOCK: Step 1 - Get Upload URL
    await page.route('**/api/admin/app-version/upload-url', async route => {
      console.log('Mocking upload-url endpoint');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          uploadUrl: mockUploadUrl,
          key: mockKey
        })
      });
    });

    // MOCK: Step 2 - Direct PUT upload
    await page.route(mockUploadUrl, async route => {
      console.log('Mocking direct PUT upload');
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'OK'
      });
    });

    // MOCK: Stats endpoint
    await page.route('**/api/admin/app-version/stats', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          updatedCount: 0,
          outdatedCount: 0,
          unknownCount: 0,
          latestVersion: null
        })
      });
    });

    // MOCK: Step 3 - Final Metadata POST & GET List
    await page.route(url => url.pathname === '/api/admin/app-version', async route => {
      console.log(`Mocking APK API: ${route.request().method()} ${route.request().url()}`);
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'mock-id-123',
              version: '1.0.99',
              buildNumber: 100,
              url: 'https://mock-storage.com/app.apk'
            }
          })
        });
      } else if (route.request().method() === 'GET') {
        // Return a list containing our mocked version
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'mock-id-123',
                version: '1.0.99',
                buildNumber: 100,
                versionCode: 100,
                platform: 'android',
                apkUrl: 'https://mock-storage.com/app.apk',
                apkSize: 1024 * 1024 * 15,
                releaseNotes: 'Mocked release',
                isForceUpdate: false,
                isActive: true,
                publishedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                user: { id: 'admin-id', name: 'Admin', email: 'admin@example.com' }
              }
            ],
            meta: {
              page: 1,
              limit: 10,
              total: 1,
              totalPages: 1
            }
          })
        });
      } else {
        await route.continue();
      }
    });

    // Correct URL for App Version - navigate AFTER setting up mocks
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

    // We need to provide a file so it goes through the upload flow
    console.log('Setting input files...');
    await page.setInputFiles('input[type="file"]', {
      name: 'test.apk',
      mimeType: 'application/vnd.android.package-archive',
      buffer: Buffer.from('mock apk content')
    });

    // Wait for file to be recognized (UI shows "✅ test.apk")
    await expect(page.getByText(/✅ test.apk/)).toBeVisible();

    // Submit
    console.log('Clicking Upload button in modal...');
    // The button text is "Upload" based on the code
    const submitBtn = page.locator('button[type="submit"]').filter({ hasText: 'Upload' });
    await submitBtn.click();

    // Verify success
    console.log('Waiting for modal to close...');
    await expect(modalHeader).not.toBeVisible({ timeout: 60000 });

    // Verify in list
    console.log('Verifying version in list...');
    // Use a more specific locator if needed, or just wait for the text
    // Note: AppVersionClient renders "v{version}"
    await expect(page.getByText(/v1\.0\.99/).first()).toBeVisible({ timeout: 15000 });
  });

});
