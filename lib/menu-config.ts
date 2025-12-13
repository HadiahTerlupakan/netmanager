/**
 * Shared Menu Configuration
 * 
 * Single source of truth for all admin portal menus.
 * Used by:
 * - Sidebar (components/layout/Sidebar.tsx)
 * - Role Permission Matrix (components/roles/PermissionMatrixEditor.tsx)
 * 
 * HOW TO ADD NEW MENU:
 * 1. Tambahkan menu baru ke array ADMIN_MENU_CONFIG di bawah
 * 2. Format: { code: 'CODE', name: 'Display Name', path: '/admin/path', icon: 'IconName' }
 * 3. Untuk submenu, tambahkan property `children` dengan array submenu
 * 4. Restart aplikasi untuk melihat perubahan
 * 
 * Lihat dokumentasi lengkap di: docs/menu-configuration.md
 */

export interface MenuConfig {
    code: string           // Unique identifier (used for permissions)
    name: string           // Display name
    path: string | null    // Route path, null if only parent container
    icon?: string          // Icon name from react-icons/hi2 (optional)
    children?: MenuConfig[] // Submenu items
    exact?: boolean        // Match path exactly (for dashboard routes)
}

/**
 * Admin Portal Menu Configuration
 * 
 * Kode permission menggunakan format:
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
        code: 'ROLES',
        name: 'Roles',
        path: '/admin/roles',
        icon: 'HiOutlineShieldCheck'
    },
    {
        code: 'NETWORK',
        name: 'Network',
        path: '/admin/network',
        icon: 'HiOutlineGlobeAlt',
        children: [
            { code: 'NETWORK.MIKROTIK', name: 'MikroTik', path: '/admin/network/mikrotik', icon: 'HiOutlineServer' },
            { code: 'NETWORK.RADIUS', name: 'RADIUS', path: '/admin/radius', icon: 'HiOutlineKey' },
            { code: 'NETWORK.OLT', name: 'OLT', path: '/admin/network/olt', icon: 'HiOutlinePresentationChartLine' },
            { code: 'NETWORK.ONU', name: 'All ONU', path: '/admin/network/onu', icon: 'HiOutlineDevicePhoneMobile', exact: true },
            { code: 'NETWORK.ONU_NEW', name: 'Add ONU', path: '/admin/network/onu/new', icon: 'HiPlus' },
            { code: 'NETWORK.ONUTYPE', name: 'ONU Type', path: '/admin/network/onutype', icon: 'HiOutlineClipboard' },
            { code: 'NETWORK.SPEEDPROFILES', name: 'Speed Profiles', path: '/admin/network/speedprofiles', icon: 'HiOutlineBolt' },
            { code: 'NETWORK.VLAN', name: 'VLAN', path: '/admin/network/vlan', icon: 'HiOutlineLink' },
        ],
    },
    {
        code: 'FTTH',
        name: 'FTTH',
        path: '/admin/ftth',
        icon: 'HiOutlineWifi',
        children: [
            { code: 'FTTH.OTB', name: 'OTB', path: '/admin/ftth/otb', icon: 'HiOutlineServer' },
            { code: 'FTTH.ODC', name: 'ODC', path: '/admin/ftth/odc', icon: 'HiOutlineArchiveBox' },
            { code: 'FTTH.ODP', name: 'ODP', path: '/admin/ftth/odp', icon: 'HiOutlineSquares2X2' },
            { code: 'FTTH.CLOSURE', name: 'Join BOX/Closure', path: '/admin/ftth/closure', icon: 'HiOutlineQueueList' },
            { code: 'FTTH.POLE', name: 'Pole/Tiang', path: '/admin/ftth/pole', icon: 'HiOutlineBolt' },
            { code: 'FTTH.KMZ', name: 'KMZ', path: '/admin/ftth/kmz', icon: 'HiOutlineDocument' },
            { code: 'FTTH.MAP', name: 'Topology Map', path: '/admin/ftth/map', icon: 'HiOutlineMap' },
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
        ],
    },
    {
        code: 'INVENTORY',
        name: 'Inventory',
        path: '/admin/inventory',
        icon: 'HiOutlineCube',
        children: [
            { code: 'INVENTORY.DASHBOARD', name: 'Dashboard', path: '/admin/inventory', icon: 'HiOutlineChartBar', exact: true },
            { code: 'INVENTORY.BARANG', name: 'Barang', path: '/admin/inventory/barang', icon: 'HiOutlineCube' },
            { code: 'INVENTORY.MASUK', name: 'Barang Masuk', path: '/admin/inventory/masuk', icon: 'HiOutlineArrowDownTray' },
            { code: 'INVENTORY.KELUAR', name: 'Barang Keluar', path: '/admin/inventory/keluar', icon: 'HiOutlineArrowUpTray' },
            { code: 'INVENTORY.TRANSFER', name: 'Transfer Antar Gudang', path: '/admin/inventory/transfer', icon: 'HiOutlineTruck' },
            { code: 'INVENTORY.RESTOCK', name: 'Restock Management', path: '/admin/inventory/restock', icon: 'HiOutlineArrowTrendingUp' },
            { code: 'INVENTORY.OPNAME', name: 'Stock Opname', path: '/admin/inventory/opname', icon: 'HiOutlineClipboard' },
            { code: 'INVENTORY.GUDANG', name: 'Gudang', path: '/admin/inventory/gudang', icon: 'HiOutlineHome' },
        ],
    },
    {
        code: 'USERS',
        name: 'Users',
        path: '/admin/users',
        icon: 'HiOutlineUsers'
    },
    {
        code: 'HELPDESK',
        name: 'Helpdesk',
        path: '/admin/helpdesk',
        icon: 'HiOutlineQuestionMarkCircle',
        children: [
            { code: 'HELPDESK.DASHBOARD', name: 'Dashboard', path: '/admin/helpdesk', icon: 'HiOutlineChartBar', exact: true },
            { code: 'HELPDESK.TIKET', name: 'Semua Tiket', path: '/admin/helpdesk/tiket', icon: 'HiOutlineQuestionMarkCircle' },
        ],
    },
    {
        code: 'WORKORDERS',
        name: 'Work Orders',
        path: '/admin/workorders',
        icon: 'HiOutlineWrench',
        children: [
            { code: 'WORKORDERS.DASHBOARD', name: 'Dashboard', path: '/admin/workorders', icon: 'HiOutlineChartBar', exact: true },
            { code: 'WORKORDERS.LIST', name: 'All Work Orders', path: '/admin/workorders/list', icon: 'HiOutlineClipboard' },
        ],
    },
    {
        code: 'HRIS',
        name: 'HRIS',
        path: '/admin/hris',
        icon: 'HiOutlineUserGroup',
        children: [
            { code: 'HRIS.DASHBOARD', name: 'Dashboard', path: '/admin/hris', icon: 'HiOutlineChartBar', exact: true },
            { code: 'HRIS.KPI', name: 'KPI Dashboard', path: '/admin/kpi', icon: 'HiOutlinePresentationChartLine' },
            { code: 'HRIS.DEPARTMENTS', name: 'Departments', path: '/admin/hris/departments', icon: 'HiOutlineHome' },
            { code: 'HRIS.SITES', name: 'Sites / Area', path: '/admin/hris/sites', icon: 'HiOutlineMap' },
            { code: 'HRIS.ATTENDANCE', name: 'Attendance', path: '/admin/hris/attendance', icon: 'HiOutlineClock' },
            { code: 'HRIS.LEAVES', name: 'Leave Management', path: '/admin/hris/leaves', icon: 'HiOutlineCalendar' },
            { code: 'HRIS.PAYROLL', name: 'Payroll', path: '/admin/hris/payroll', icon: 'HiOutlineArrowTrendingUp' },
        ],
    },
    {
        code: 'FINANCE',
        name: 'Finance',
        path: '/admin/finance',
        icon: 'HiOutlineCurrencyDollar',
        children: [
            { code: 'FINANCE.TAGIHAN', name: 'Tagihan', path: '/admin/finance/tagihan', icon: 'HiOutlineDocumentText' },
            { code: 'FINANCE.CASHFLOW', name: 'Cashflow & Pengeluaran', path: '/admin/finance/cashflow', icon: 'HiOutlineArrowTrendingUp' },
            { code: 'FINANCE.BANK_ACCOUNTS', name: 'Rekening Bank', path: '/admin/finance/bank-accounts', icon: 'HiOutlineArrowTrendingUp' },
        ],
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
            { code: 'PENGATURAN.OAUTH', name: 'OAuth', path: '/admin/pengaturan/oauth', icon: 'HiOutlineKey' },
            { code: 'PENGATURAN.PAYMENT_GATEWAY', name: 'Payment Gateway', path: '/admin/pengaturan/payment-gateway', icon: 'HiOutlineCreditCard' },
            { code: 'PENGATURAN.API', name: 'API', path: '/admin/pengaturan/api', icon: 'HiOutlineCodeBracket' },
        ],
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
