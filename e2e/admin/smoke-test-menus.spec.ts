
import { test, expect, type Page } from '@playwright/test'

const SUPER_ADMIN = {
  email: 'admin@example.com',
  password: 'admin123'
}

// Flattened list of paths from ADMIN_MENU_CONFIG
const MENU_PATHS = [
    { name: 'Dashboard', path: '/admin' },
    // Network
    { name: 'MikroTik', path: '/admin/network/mikrotik' },
    { name: 'RADIUS', path: '/admin/network/radius' },
    { name: 'OLT', path: '/admin/network/olt' },
    { name: 'ONU', path: '/admin/network/onu' },
    { name: 'ONU Type', path: '/admin/network/onutype' },
    { name: 'Speed Profiles', path: '/admin/network/speedprofiles' },
    { name: 'VLAN', path: '/admin/network/vlan' },
    // FTTH
    { name: 'OTB', path: '/admin/ftth/otb' },
    { name: 'ODC', path: '/admin/ftth/odc' },
    { name: 'ODP', path: '/admin/ftth/odp' },
    { name: 'Join BOX/Closure', path: '/admin/ftth/closure' },
    { name: 'Pole/Tiang', path: '/admin/ftth/pole' },
    { name: 'KMZ', path: '/admin/ftth/kmz' },
    { name: 'Topology Map', path: '/admin/ftth/map' },
    // Paket
    { name: 'Bandwidth', path: '/admin/paket/bandwidth' },
    { name: 'Profile PPP', path: '/admin/paket/profileppp' },
    { name: 'Harga Paket', path: '/admin/paket/harga' },
    // Pelanggan
    { name: 'Pelanggan PPP', path: '/admin/pelanggan/ppp' },
    { name: 'Pelanggan Registrasi', path: '/admin/registrations' },
    // Inventory
    { name: 'Inventory Dashboard', path: '/admin/inventory' },
    { name: 'Barang', path: '/admin/inventory/barang' },
    { name: 'Barang Masuk', path: '/admin/inventory/masuk' },
    { name: 'Barang Keluar', path: '/admin/inventory/keluar' },
    { name: 'Transfer Antar Gudang', path: '/admin/inventory/transfer' },
    { name: 'Restock Management', path: '/admin/inventory/restock' },
    { name: 'Stock Opname', path: '/admin/inventory/opname' },
    { name: 'Gudang', path: '/admin/inventory/gudang' },
    // Users
    { name: 'Users', path: '/admin/users' },
    // Work Orders
    { name: 'WO Dashboard', path: '/admin/workorders' },
    { name: 'WO List', path: '/admin/workorders/list' },
    { name: 'WO Site', path: '/admin/workorders/sites' },
    { name: 'WO Department', path: '/admin/workorders/departments' },
    // Kehadiran
    { name: 'Laporan', path: '/admin/kehadiran/laporan' },
    { name: 'Data Absensi', path: '/admin/attendance' },
    { name: 'Hari Libur', path: '/admin/kehadiran/holidays' },
    { name: 'Manajemen Lembur', path: '/admin/lembur' },
    { name: 'Izin & Cuti', path: '/admin/kehadiran/izin' },
    // Support
    { name: 'Dukungan', path: '/admin/support' },
    // Marketing
    { name: 'Manajemen Kupon', path: '/admin/marketing/coupons' },
    // Pengumuman
    { name: 'Pengumuman', path: '/admin/announcement' },
    // Pengaturan
    { name: 'Umum', path: '/admin/pengaturan/umum' },
    { name: 'Logo Perusahaan', path: '/admin/pengaturan/logo' },
    { name: 'Email', path: '/admin/pengaturan/email' },
    { name: 'WhatsApp', path: '/admin/pengaturan/whatsapp' },
    { name: 'Hak Akses & Role', path: '/admin/settings/roles' },
    { name: 'Payment Gateway', path: '/admin/pengaturan/payment-gateway' },
    { name: 'API', path: '/admin/pengaturan/api' },
    // Finance
    { name: 'Pendapatan Harian', path: '/admin/finance/pendapatan-harian' },
    { name: 'Pendapatan Periode', path: '/admin/finance/pendapatan-periode' },
    { name: 'Pengeluaran', path: '/admin/finance/pengeluaran' },
    { name: 'Laba Rugi', path: '/admin/finance/laba-rugi' },
    // System Log
    { name: 'Log Login', path: '/admin/log/login' },
    { name: 'Log Aktivitas', path: '/admin/log/activity' },
]

// Robust login function from rbac.spec.ts
async function loginAsAdmin(page: Page) {
  try {
    await page.goto('/admin/login')
    await page.waitForSelector('#email', { timeout: 10000 })
    await page.fill('#email', SUPER_ADMIN.email)
    await page.fill('#password', SUPER_ADMIN.password)
    await page.click('button[type="submit"]')
    
    // Wait for navigation away from login
    await page.waitForFunction(
      () => !window.location.pathname.includes('login'),
      { timeout: 20000 }
    )
    await page.waitForLoadState('domcontentloaded')
    // Additional wait to ensure dashboard is ready
    await page.waitForTimeout(1000)
    return true
  } catch (error) {
    console.error('Login failed:', error)
    return false
  }
}

test.describe('Admin Menu Smoke Test', () => {
    // Increase timeout for all tests in this suite
    test.setTimeout(60000)

    test.beforeEach(async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        expect(loggedIn, 'Login failed').toBeTruthy()
    })

    for (const menu of MENU_PATHS) {
        test(`should access ${menu.name} page at ${menu.path}`, async ({ page }) => {
            console.log(`Navigating to: ${menu.path}`)
            await page.goto(menu.path, { timeout: 30000, waitUntil: 'domcontentloaded' })
            
            // Avoid networkidle as it hangs on pages with polling/websockets
            // Instead wait for key elements that indicate success or failure
            try {
                // Wait for either H1 (success) or error message
                await Promise.race([
                    page.waitForSelector('h1', { timeout: 10000 }),
                    page.waitForSelector('text=404', { timeout: 5000 }),
                    page.waitForSelector('text=403', { timeout: 5000 }),
                    page.waitForSelector('text=Error', { timeout: 5000 })
                ])
            } catch (e) {
                console.log(`Note: No specific element found on ${menu.path} within timeout, proceeding to check visible text`)
            }
            
            // Check for common error indicators
            const is404 = await page.getByText('404').isVisible().catch(() => false)
            const is403 = await page.getByText('403').isVisible().catch(() => false)
            const isError = await page.getByText('Internal Server Error').isVisible().catch(() => false)
            
            expect(is404, `Page ${menu.name} (${menu.path}) returned 404`).toBeFalsy()
            expect(is403, `Page ${menu.name} (${menu.path}) returned 403`).toBeFalsy()
            expect(isError, `Page ${menu.name} (${menu.path}) returned 500`).toBeFalsy()

            // Verify URL matches (ignoring query params)
            const url = page.url()
            // Some pages might redirect (e.g. if list empty or other logic), so we just warn
            if (!url.includes(menu.path)) {
                console.warn(`Warning: Expected URL to contain ${menu.path}, but got ${url}. This might be a redirect.`)
            }
        })
    }
})
