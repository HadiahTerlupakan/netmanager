/**
 * Static Menu Configuration
 *
 * Fixed menu configuration for admin portal.
 * Used by:
 * - Sidebar (components/layout/Sidebar.tsx)
 *
 * HOW TO ADD NEW MENU:
 * 1. Tambahkan menu baru ke array ADMIN_MENU_CONFIG di bawah
 * 2. Format: { code: 'CODE', name: 'Display Name', path: '/admin/path', icon: 'IconName' }
 * 3. Untuk submenu, tambahkan property `children` dengan array submenu
 * 4. Restart aplikasi untuk melihat perubahan
 */

export interface MenuConfig {
    code: string           // Unique identifier
    name: string           // Display name
    path: string | null    // Route path, null if only parent container
    icon?: string          // Icon name from react-icons/hi2 (optional)
    children?: MenuConfig[] // Submenu items
    exact?: boolean        // Match path exactly (for dashboard routes)
}

/**
 * Admin Portal Menu Configuration
 *
 * Menu codes menggunakan format:
 * - Parent: 'NETWORK', 'FTTH', 'PELANGGAN', etc.
 * - Child: 'NETWORK.MIKROTIK', 'NETWORK.OLT', etc.
 */
export const ADMIN_MENU_CONFIG: MenuConfig[] = [
    {
        code: 'DASHBOARD',
        name: 'Dashboard',
        path: '/admin',
        icon: 'HiOutlineChartBar',
        exact: true
    },
    {
        code: 'NETWORK',
        name: 'Network',
        path: '/admin/network',
        icon: 'HiOutlineGlobeAlt',
        children: [
            { code: 'NETWORK.MIKROTIK', name: 'MikroTik', path: '/admin/network/mikrotik', icon: 'HiOutlineServer' },
            { code: 'NETWORK.RADIUS', name: 'RADIUS', path: '/admin/network/radius', icon: 'HiOutlineKey' },
            { code: 'NETWORK.SPEEDPROFILES', name: 'Speed Profiles', path: '/admin/network/speedprofiles', icon: 'HiOutlineBolt' },
            { code: 'NETWORK.VLAN', name: 'VLAN', path: '/admin/network/vlan', icon: 'HiOutlineLink' },
        ],
    },
    {
        code: 'PAKET',
        name: 'Paket',
        path: '/admin/paket',
        icon: 'HiOutlineShoppingCart',
        children: [
            { code: 'PAKET.BANDWIDTH', name: 'Bandwidth', path: '/admin/paket/bandwidth', icon: 'HiOutlineCircleStack' },
            { code: 'PAKET.PROFILEPPP', name: 'Profile PPP', path: '/admin/paket/profileppp', icon: 'HiOutlineUser' },
            { code: 'PAKET.HARGA', name: 'Harga Paket', path: '/admin/paket/harga', icon: 'HiOutlineCurrencyDollar' },
        ],
    },
    {
        code: 'PELANGGAN',
        name: 'Pelanggan',
        path: '/admin/pelanggan',
        icon: 'HiOutlineUsers',
        children: [
            { code: 'PELANGGAN.PPP', name: 'Pelanggan PPP', path: '/admin/pelanggan/ppp', icon: 'HiOutlineUser' },
            { code: 'PELANGGAN.REGISTRATION', name: 'Pelanggan Registrasi', path: '/admin/registrations', icon: 'HiOutlineClipboardDocumentCheck' },
        ],
    },
    {
        code: 'INVENTORY',
        name: 'Inventory',
        path: '/admin/inventory',
        icon: 'HiOutlineCube',
        children: [
            { code: 'INVENTORY.INVENTORY', name: 'Dashboard', path: '/admin/inventory', icon: 'HiOutlineChartBar', exact: true },
            { code: 'INVENTORY.BARANG', name: 'Barang', path: '/admin/inventory/barang', icon: 'HiOutlineCube' },
            { code: 'INVENTORY.MASUK', name: 'Barang Masuk', path: '/admin/inventory/masuk', icon: 'HiOutlineArrowDownTray' },
            { code: 'INVENTORY.KELUAR', name: 'Barang Keluar', path: '/admin/inventory/keluar', icon: 'HiOutlineArrowUpTray' },
            { code: 'INVENTORY.TRANSFER', name: 'Transfer Antar Gudang', path: '/admin/inventory/transfer', icon: 'HiOutlineTruck' },
            { code: 'INVENTORY.RESTOCK', name: 'Restock Management', path: '/admin/inventory/restock', icon: 'HiOutlineArrowTrendingUp' },
            { code: 'INVENTORY.OPNAME', name: 'Stock Opname', path: '/admin/inventory/opname', icon: 'HiOutlineClipboard' },
            { code: 'INVENTORY.GUDANG', name: 'Gudang', path: '/admin/inventory/gudang', icon: 'HiOutlineHome' },
            { code: 'INVENTORY.ASSETS', name: 'Aset Tetap', path: '/admin/inventory/assets', icon: 'HiOutlineComputerDesktop' },
        ],
    },
    {
        code: 'PROCUREMENT',
        name: 'Procurement',
        path: '/admin/procurement',
        icon: 'HiOutlineShoppingBag',
        children: [
            { code: 'PROCUREMENT.PROCUREMENT', name: 'Dashboard', path: '/admin/procurement', icon: 'HiOutlineChartBar', exact: true },

            { code: 'PROCUREMENT.PURCHASE_ORDERS', name: 'Purchase Order', path: '/admin/procurement/purchase-orders', icon: 'HiOutlineDocumentText' },
            { code: 'PROCUREMENT.MARKET_PRICE', name: 'Analisa Harga Pasar', path: '/admin/procurement/market-price', icon: 'HiOutlinePresentationChartBar' },
        ],
    },
    {
        code: 'USERS',
        name: 'Users',
        path: '/admin/users',
        icon: 'HiOutlineUsers'
    },
    {
        code: 'WORKORDERS',
        name: 'Work Orders',
        path: '/admin/workorders',
        icon: 'HiOutlineWrench',
        children: [
            { code: 'WORKORDERS.WORK_ORDER_DASHBOARD', name: 'Dashboard', path: '/admin/workorders', icon: 'HiOutlineChartBar', exact: true },
            { code: 'WORKORDERS.LIST', name: 'List', path: '/admin/workorders/list', icon: 'HiOutlineClipboardDocumentList' },
            { code: 'WORKORDERS.SITE', name: 'Site', path: '/admin/workorders/sites', icon: 'HiOutlineBuildingOffice' },
            { code: 'WORKORDERS.DEPARTMENT', name: 'Department', path: '/admin/workorders/departments', icon: 'HiOutlineUserGroup' },
        ],
    },
    {
        code: 'KEHADIRAN',
        name: 'Kehadiran',
        path: '/admin/kehadiran',
        icon: 'HiOutlineClipboardDocumentCheck',
        children: [
            { code: 'KEHADIRAN.REPORT', name: 'Laporan', path: '/admin/kehadiran/laporan', icon: 'HiOutlineDocumentText' },
            { code: 'KEHADIRAN.ATTENDANCE', name: 'Data Absensi', path: '/admin/attendance', icon: 'HiOutlineClipboardDocumentList' },
            { code: 'KEHADIRAN.LIVE_TRACKING', name: 'Live Tracking', path: '/admin/kehadiran/live-map', icon: 'HiOutlineMapPin' },
            { code: 'KEHADIRAN.HOLIDAY', name: 'Hari Libur', path: '/admin/kehadiran/holidays', icon: 'HiOutlineCalendar' },
            { code: 'KEHADIRAN.LEMBUR', name: 'Manajemen Lembur', path: '/admin/lembur', icon: 'HiOutlineClock' },
            { code: 'KEHADIRAN.IZIN', name: 'Izin & Cuti', path: '/admin/kehadiran/izin', icon: 'HiOutlineClipboardDocumentCheck' },
            { code: 'KEHADIRAN.SHIFT', name: 'Manajemen Shift', path: '/admin/kehadiran/shift', icon: 'HiOutlineArrowPath' },
        ],
    },
    {
        code: 'SALARY',
        name: 'Penggajian',
        path: '/admin/salary',
        icon: 'HiOutlineCurrencyDollar',
        children: [
            { code: 'SALARY.SALARY', name: 'Daftar Gaji', path: '/admin/salary', icon: 'HiOutlineClipboardDocumentList', exact: true },
            { code: 'SALARY.USERS', name: 'Karyawan Digaji', path: '/admin/salary/users', icon: 'HiOutlineUsers' },
        ],
    },
    {
        code: 'SUPPORT',
        name: 'Dukungan',
        path: '/admin/support',
        icon: 'HiOutlineChatBubbleLeftRight',
    },

    {
        code: 'CHAT',
        name: 'Chat',
        path: '/admin/chat',
        icon: 'HiOutlineChatBubbleLeftRight',
    },

    {
        code: 'MARKETING',
        name: 'Marketing',
        path: '/admin/marketing',
        icon: 'HiOutlineMegaphone',
        children: [
            { code: 'MARKETING.SALES_DASHBOARD', name: 'Dashboard Sales', path: '/admin/marketing/sales-dashboard', icon: 'HiOutlineChartBar' },
            { code: 'MARKETING.COUPON', name: 'Manajemen Kupon', path: '/admin/marketing/coupons', icon: 'HiOutlineTicket' },
            { code: 'MARKETING.SALES', name: 'Manajemen Sales', path: '/admin/marketing/sales', icon: 'HiOutlineUsers' },
            { code: 'MARKETING.CANVASING', name: 'Canvasing', path: '/admin/marketing/canvasing', icon: 'HiOutlineClipboardDocumentList' },
        ]
    },
    {
        code: 'ANNOUNCEMENT',
        name: 'Pengumuman',
        path: '/admin/announcement',
        icon: 'HiOutlineMegaphone',
    },
    {
        code: 'PENGATURAN',
        name: 'Pengaturan',
        path: '/admin/pengaturan',
        icon: 'HiOutlineCog6Tooth',
        children: [
            { code: 'PENGATURAN.UMUM', name: 'Umum', path: '/admin/pengaturan/umum', icon: 'HiOutlineCog6Tooth' },
            { code: 'PENGATURAN.LOGO', name: 'Logo Perusahaan', path: '/admin/pengaturan/logo', icon: 'HiOutlinePhoto' },
            { code: 'PENGATURAN.EMAIL', name: 'Email', path: '/admin/pengaturan/email', icon: 'HiOutlineEnvelope' },
            { code: 'PENGATURAN.WHATSAPP', name: 'WhatsApp', path: '/admin/pengaturan/whatsapp', icon: 'HiOutlineChatBubbleLeftRight' },
            { code: 'PENGATURAN.ROLES', name: 'Hak Akses & Role', path: '/admin/settings/roles', icon: 'HiOutlineShieldCheck' },
            { code: 'PENGATURAN.PAYMENT_GATEWAY', name: 'Payment Gateway', path: '/admin/pengaturan/payment-gateway', icon: 'HiOutlineCreditCard' },
            { code: 'PENGATURAN.API', name: 'API', path: '/admin/pengaturan/api', icon: 'HiOutlineCodeBracket' },
            { code: 'PENGATURAN.NADA_DERING', name: 'Nada Dering', path: '/admin/pengaturan/nada-dering', icon: 'HiOutlineSpeakerWave' },
            { code: 'PENGATURAN.APP_VERSION', name: 'Versi Aplikasi', path: '/admin/pengaturan/app-version', icon: 'HiOutlineDevicePhoneMobile' },
        ],
    },
    {
        code: 'FINANCE',
        name: 'Data Keuangan',
        path: '/admin/finance',
        icon: 'HiOutlineCurrencyDollar',
        children: [
            { code: 'FINANCE.FINANCE', name: 'Hutang & Piutang', path: '/admin/finance/debts-receivables', icon: 'HiOutlineClipboardDocumentList' },
            { code: 'FINANCE.FINANCE', name: 'Kas & Bank', path: '/admin/finance/accounts', icon: 'HiOutlineBuildingLibrary' },
            { code: 'FINANCE.FINANCE', name: 'Daftar Transaksi', path: '/admin/finance/transactions', icon: 'HiOutlineQueueList' },
            { code: 'FINANCE.FINANCE', name: 'Kategori Transaksi', path: '/admin/finance/categories', icon: 'HiOutlineTag' },
            { code: 'FINANCE.FINANCE', name: 'Laporan & Analisis', path: '/admin/finance/reports', icon: 'HiOutlineChartPie' }
        ],
    },
    {
        code: 'SYSTEM_LOG',
        name: 'System Log',
        path: '/admin/log',
        icon: 'HiOutlineClipboardDocumentList',
        children: [
            { code: 'SYSTEM_LOG.SYSTEM_LOG', name: 'Log Login', path: '/admin/log/login', icon: 'HiOutlineShieldCheck' },
            { code: 'SYSTEM_LOG.SYSTEM_LOG', name: 'Log Aktivitas', path: '/admin/log/activity', icon: 'HiOutlineDocumentText' },
        ],
    },
    {
        code: 'INTEGRATION',
        name: 'Integrasi',
        path: '/admin/integrations',
        icon: 'HiOutlineArrowsRightLeft',
        children: [
            { code: 'INTEGRATION.MIXRADIUS', name: 'MixRadius', path: '/admin/integrations/mixradius', icon: 'HiOutlineCloud' },
            { code: 'INTEGRATION.MIXRADIUS_ISOLIR', name: 'MixRadius Isolir', path: '/admin/integrations/mixradius/isolir', icon: 'HiOutlineNoSymbol' },
            { code: 'INTEGRATION.MIXRADIUS_SITES', name: 'Manajemen Site', path: '/admin/integrations/mixradius/groups', icon: 'HiOutlineBuildingOffice' },
            { code: 'INTEGRATION.MIXRADIUS_ACCOUNTS', name: 'Akun MixRadius', path: '/admin/integrations/mixradius/accounts', icon: 'HiOutlineServer' },
        ],
    },
]

export const EMPLOYEE_MENU_CONFIG: MenuConfig[] = [
    {
        code: 'DASHBOARD',
        name: 'Beranda',
        path: '/karyawan/dashboard',
        icon: 'HiOutlineHome',
        exact: true
    },
    {
        code: 'WORK_ORDER',
        name: 'Work Order',
        path: '/karyawan/work-order',
        icon: 'HiOutlineClipboard',
    },
    {
        code: 'INVENTORY',
        name: 'Barang',
        path: '/karyawan/barang',
        icon: 'HiOutlineCube',
    },
    {
        code: 'ATTENDANCE',
        name: 'Absensi',
        path: '/karyawan/absensi',
        icon: 'HiOutlineQrCode',
    },
    {
        code: 'PROFILE',
        name: 'Profil',
        path: '/karyawan/profil',
        icon: 'HiOutlineUser',
    },
]

/**
 * Helper: Flatten menu config untuk list semua menu (parent + children)
 */
export function flattenMenuConfig(menus: MenuConfig[]): MenuConfig[] {
    const result: MenuConfig[] = []
    for (const menu of menus) {
        result.push(menu)
        if (menu.children && menu.children.length > 0) {
            result.push(...flattenMenuConfig(menu.children))
        }
    }
    return result
}

/**
 * Helper: Get all menu codes
 */
export function getAllMenuCodes(menus: MenuConfig[] = ADMIN_MENU_CONFIG): string[] {
    return flattenMenuConfig(menus).map(m => m.code)
}

/**
 * Helper: Convert MenuConfig to format expected by PermissionMatrixEditor
 */
export function toPermissionMenuFormat(menus: MenuConfig[] = ADMIN_MENU_CONFIG) {
    return menus.map(menu => ({
        id: menu.code,
        code: menu.code,
        name: menu.name,
        parentCode: null,
        path: menu.path,
        icon: menu.icon || null,
        sortOrder: 0,
        portal: 'admin',
        children: menu.children?.map(child => ({
            id: child.code,
            code: child.code,
            name: child.name,
            parentCode: menu.code,
            path: child.path,
            icon: child.icon || null,
            sortOrder: 0,
            portal: 'admin',
        }))
    }))
}
