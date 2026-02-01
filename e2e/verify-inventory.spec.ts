import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './utils/auth';

test.describe('Inventory Module Verification', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await loginAsAdmin(page, 'admin@example.com', 'admin123');
    });

    test('should load inventory table correctly', async ({ page }) => {
        // Navigate to Inventory page
        await page.goto('/admin/inventory/barang');
        await page.waitForTimeout(3000); // Wait for potential redirect
        
        const url = page.url();
        console.log('Current URL:', url);
        
        if (url.includes('login')) {
             console.error('Login failed! Redirected to login page.');
             console.log('Page text:', await page.innerText('body'));
             throw new Error('Login failed');
        }

        // Wait for header "Manajemen Barang"
        try {
            await expect(page.locator('h1', { hasText: 'Manajemen Barang' })).toBeVisible({ timeout: 10000 });
        } catch (e) {
            console.log('Header not found. Page content:', await page.content());
            throw e;
        }

        // Check if loading indicator from Suspense or Table disappears
        await expect(page.locator('text=Memuat data barang...')).not.toBeVisible({ timeout: 10000 });

        // Check for the search input (part of BarangTable)
        await expect(page.getByPlaceholder('Cari barang...')).toBeVisible({ timeout: 10000 });

        // Check for "Daftar Barang" subheader
        await expect(page.locator('h2', { hasText: 'Daftar Barang' })).toBeVisible();

        // Check contents
        const emptyMessage = page.locator('text=Tidak ada data barang');
        const tableRows = page.locator('table tbody tr'); 
        
        // Wait for either empty message or rows
        // Note: ResponsiveTable might use div based layout, but let's assume it renders some text content for rows if existing.
        // We just need to ensure it's not "Loading..." forever.
        
        // We already checked "Memuat data barang..." is gone.
        // So checking for empty message or rows is good.
        
        if (await emptyMessage.isVisible()) {
             console.log('Table is empty.');
        } else {
             // If not empty, we expect rows
             const rowCount = await tableRows.count();
             console.log(`Table has ${rowCount} rows.`);
             // If rowCount is 0 but default empty message is not visible, maybe custom empty message?
        }
        
        await page.screenshot({ path: 'inventory-verification-success.png' });
    });
});
