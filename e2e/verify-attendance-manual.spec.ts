import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './auth/login.spec';

test.describe('Attendance Manual Input Verification', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page, 'admin@example.com', 'admin123');
    });

    test('should successfully input manual leave request', async ({ page }) => {
        // 1. Navigate to "Izin & Cuti" page
        await page.goto('/admin/kehadiran/izin');
        
        // Wait for page to load (check title)
        await expect(page.locator('h1', { hasText: 'Manajemen Izin & Cuti' })).toBeVisible({ timeout: 10000 });

        // 2. Open "Input Manual" Modal
        await page.click('button:has-text("Input Manual")');
        
        // Wait for modal
        await expect(page.locator('h3', { hasText: 'Input Izin Manual' })).toBeVisible();

        // 3. Fill Form
        // Select Employee (Search and click first result)
        
        // Intercept the users API call to debug
        const usersResponsePromise = page.waitForResponse(response => 
            response.url().includes('/api/admin/users') && response.status() === 200
        );
        
        const searchInput = page.getByPlaceholder('Cari karyawan...');
        await searchInput.click();
        
        // Wait for usage of the users API which happens on click/focus per code
        const response = await usersResponsePromise;
        const usersData = await response.json();
        console.log('API Users Data:', JSON.stringify(usersData).slice(0, 200)); // Log first 200 chars
        
        await searchInput.fill('Budi'); 
        
        // Wait for results
        const dropdown = page.locator('.absolute.z-10');
        await expect(dropdown).toBeVisible();

        // Log dropdown content for debug
        console.log('Dropdown text:', await dropdown.innerText());

        const dropdownItem = dropdown.locator('div').filter({ hasText: 'Budi' }).first();
        await dropdownItem.waitFor({ state: 'visible', timeout: 5000 });
        await dropdownItem.click();

        // Select Type (Checking defaults, let's change to IZIN)
        await page.selectOption('select', 'IZIN');

        // Dates
        // Use today for start and end
        const today = new Date().toISOString().split('T')[0];
        
        // There are two date inputs, one for start, one for end.
        // Based on IzinClient.tsx, they appear in that order in the grid.
        // We can use nth(0) and nth(1) or find by surrounding label if possible, 
        // but label is "Mulai" and "Selesai".
        
        // Helper to fill date by label
        const startDateInput = page.locator('label:has-text("Mulai") + input[type="date"]'); // This selector assumption might be weak if structure differs
        // Alternative: Input following the label
        await page.fill('input[type="date"] >> nth=0', today);
        await page.fill('input[type="date"] >> nth=1', today);

        // Reason
        const reason = `Manual Input Test ${Date.now()}`;
        await page.fill('textarea', reason);

        // 4. Submit
        
        // Intercept POST request to debug payload
        const submitRequestPromise = page.waitForRequest(request => 
            request.url().includes('/api/admin/leaves') && request.method() === 'POST'
        );
        
        await page.click('button:has-text("Simpan")');
        
        const request = await submitRequestPromise;
        console.log('Submit Payload:', request.postDataJSON());

        // 5. Verify Success
        // 5. Verify Success
        try {
            await expect(page.locator('text=Pengajuan manual berhasil dibuat')).toBeVisible({ timeout: 5000 });
        } catch (e) {
            console.log("Success toast not found. Checking for errors...");
            const errorToast = await page.locator('.go3958317564').allInnerTexts(); // Common toast class or try generic text
            const content = await page.content();
            if (content.includes('Gagal') || content.includes('Mohon lengkapi') || content.includes('error')) {
                console.log("Found potential error text in page:", content.slice(content.indexOf('Gagal') - 50, content.indexOf('Gagal') + 100));
            }
            await page.screenshot({ path: 'manual-input-fail.png' });
            throw e;
        }
        
        // Wait for modal to disappear
        await expect(page.locator('h3', { hasText: 'Input Izin Manual' })).not.toBeVisible();

        // 6. Verify List Update
        // The list should refresh. Check if our new reason appears in the table.
        // We might need to switch filter to "ALL" or "APPROVED" depending on default status?
        // Default status for manual input usually PENDING or APPROVED depending on logic.
        // IzinClient.tsx: setFilterStatus('PENDING') is default. 
        // Let's search for the reason text.
        
        await expect(page.locator('table')).toContainText(reason);
    });
});
