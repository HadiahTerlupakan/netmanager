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
    MARKETING: ['marketing', 'coupon', 'canvasing'],
    CHAT: ['chat', 'broadcast'],
    USERS: ['users'],

} as const

export const PERMISSION_GROUPS_KARYAWAN = {
    DASHBOARD: ['k_dashboard'],
    WORK_ORDER: ['k_work_order'],
    INVENTORY: ['k_barang'],
    ATTENDANCE: ['k_absensi'],
    PROFILE: ['k_profil'],
    NOTIFICATION: ['k_notification']
} as const

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
