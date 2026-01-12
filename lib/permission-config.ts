export const PERMISSION_GROUPS = {
    DASHBOARD: ['dashboard'],
    NETWORK: ['network', 'mikrotik', 'radius', 'olt', 'onu', 'onutype', 'speedprofiles', 'vlan'],
    FTTH: ['ftth', 'otb', 'odc', 'odp', 'closure', 'pole', 'kmz', 'map'],
    PAKET: ['paket', 'bandwidth', 'profileppp', 'harga'],
    PELANGGAN: ['pelanggan', 'ppp', 'registration'],
    INVENTORY: ['inventory', 'barang', 'masuk', 'keluar', 'transfer', 'restock', 'opname', 'gudang'],
    WORKORDERS: ['workorders', 'work_order_dashboard', 'list', 'site', 'department'],
    KEHADIRAN: ['kehadiran', 'attendance', 'report', 'lembur', 'holiday', 'izin', 'live_tracking'],
    FINANCE: ['finance', 'daily_income', 'period_income', 'expense', 'profit_loss'],
    PENGATURAN: ['pengaturan', 'umum', 'logo', 'email', 'whatsapp', 'roles', 'payment_gateway', 'api', 'nada_dering', 'app_version'],
    SYSTEM_LOG: ['system_log', 'login', 'activity'],
    SUPPORT: ['support'],
    ANNOUNCEMENT: ['announcement'],
    MARKETING: ['marketing', 'coupon', 'sales_dashboard', 'sales', 'canvasing'],
    CHAT: ['chat', 'broadcast'],
    USERS: ['users'],

} as const

/**
 * Mobile App Permission Groups
 * 
 * Mengontrol akses fitur di Mobile App karyawan.
 * Prefix 'm_' digunakan untuk membedakan resource mobile dari resource admin.
 */
export const PERMISSION_GROUPS_MOBILE = {
    BERANDA: ['m_dashboard', 'm_work_order'],
    INVENTORY: ['m_barang', 'm_barang_masuk', 'm_barang_keluar'],
    KEHADIRAN: ['m_absensi', 'm_lembur', 'm_izin', 'm_holidays'],
    PETA: ['m_topology_map'],
    MARKETING: ['m_canvasing'],
    KOMUNIKASI: ['m_chat']
} as const

// Backward compatibility alias (used by existing seed scripts)
export const PERMISSION_GROUPS_KARYAWAN = PERMISSION_GROUPS_MOBILE


export type PermissionGroup = keyof typeof PERMISSION_GROUPS

/**
 * Permission Actions
 * 
 * - `read`: Melihat/membaca data
 * - `create`: Membuat data baru
 * - `update`: Mengubah data yang ada
 * - `delete`: Menghapus data
 * - `site_only`: **SITE RESTRICTION** - Jika role memiliki permission ini,
 *   user akan DIBATASI hanya bisa mengakses data dari site mereka sendiri.
 *   Jika role TIDAK memiliki permission ini, user bisa melihat SEMUA site.
 *   SUPER_ADMIN selalu bypass restriction ini.
 * 
 * Contoh penggunaan di Role Matrix:
 * - Role "Admin" dengan `users:read` (tanpa site_only) = lihat semua users
 * */
export const ACTIONS = ['read', 'create', 'update', 'delete', 'site_only', 'department_only', 'cancel', 'verify'] as const
