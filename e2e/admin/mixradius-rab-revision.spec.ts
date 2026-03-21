import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'password'

async function loginAsAdmin(page: import('@playwright/test').Page) {
    await page.goto('/admin/login')
    await page.waitForSelector('#email', { state: 'visible', timeout: 60000 })
    await page.fill('#email', ADMIN_EMAIL)
    await page.fill('#password', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(url => 
        url.pathname.includes('/admin') && !url.pathname.includes('/login'),
        { timeout: 60000 }
    )
}

test.describe('MixRadius RAB Revision UX', () => {
    test('menampilkan alur revisi yang lebih jelas di daftar dan detail', async ({ page }) => {
        await loginAsAdmin(page)

        await page.goto('/admin/integrations/mixradius/expenses')
        await page.getByRole('button', { name: 'RAB (Proyek)' }).click()

        await expect(page.getByText('Alur revisi RAB (disederhanakan)')).toBeVisible()

        const detailButton = page.getByRole('button', { name: /Lihat Detail/i }).first()
        await expect(detailButton).toBeVisible()
        await detailButton.click()

        await expect(page.getByText('Ringkasan Dampak Revisi')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Buka Form Revisi' })).toBeVisible()
    })

    test('modal tolak revisi tampil konsisten bila ada revisi pending', async ({ page }) => {
        await loginAsAdmin(page)

        await page.goto('/admin/integrations/mixradius/expenses')
        await page.getByRole('button', { name: 'RAB (Proyek)' }).click()

        const detailButton = page.getByRole('button', { name: /Lihat Detail/i }).first()
        await detailButton.click()

        const rejectButton = page.getByRole('button', { name: 'Tolak dengan Catatan' }).first()
        if (await rejectButton.isVisible().catch(() => false)) {
            await rejectButton.click()
            await expect(page.getByRole('heading', { name: 'Tolak Revisi' })).toBeVisible()
            await expect(page.getByPlaceholder(/harga satuan item backbone/i)).toBeVisible()
        } else {
            test.skip(true, 'Tidak ada revisi dengan status menunggu approval di data uji.')
        }
    })
})

