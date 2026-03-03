export const PERMISSION_GROUPS = {
  DASHBOARD: ['dashboard'],
  NETWORK: ['network', 'map', 'mikrotik', 'radius', 'acs_dashboard', 'acs_mapping', 'acs_devices'],
  PAKET: ['paket', 'bandwidth', 'profileppp', 'harga'],
  PELANGGAN: ['pelanggan', 'ppp', 'registration'],
  INVENTORY: ['inventory', 'barang', 'masuk', 'keluar', 'transfer', 'restock', 'opname', 'gudang', 'assets'],
  PROCUREMENT: ['procurement', 'supplier', 'purchase_orders', 'market_price'],
  WORKORDERS: ['workorders', 'work_order_dashboard', 'list', 'site', 'department'],
  KEHADIRAN: ['kehadiran', 'attendance', 'report', 'lembur', 'holiday', 'izin', 'live_tracking', 'shift'],
  FINANCE: ['finance', 'accounts', 'debts_receivables', 'treasury', 'transactions', 'manual_payments', 'categories', 'reports', 'daily_income', 'period_income', 'expense', 'profit_loss'],
  PENGATURAN: ['pengaturan', 'umum', 'logo', 'email', 'whatsapp', 'roles', 'payment_gateway', 'api', 'nada_dering', 'app_version', 'acs'],
  SYSTEM_LOG: ['system_log', 'login', 'activity'],
  INTEGRATION: ['mixradius', 'mixradius_isolir', 'mixradius_sites', 'mixradius_investor_sites', 'mixradius_accounts', 'mixradius_income', 'mixradius_expenses', 'mixradius_profit_loss'],
  SUPPORT: ['support'],
  ANNOUNCEMENT: ['announcement'],
  MARKETING: ['marketing', 'coupon', 'sales_dashboard', 'sales', 'canvasing'],
  CHAT: ['chat', 'broadcast'],
  USERS: ['users'],
  MITRA: ['mitra', 'withdrawals'],
  INVESTORS: ['investors'],
  SALARY: ['salary', 'salary_users'],
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
  MARKETING: ['m_canvasing'],
  KOMUNIKASI: ['m_chat'],
  FINANCE: ['m_salary'],
  NETWORK: ['m_topology'],
  INTEGRASI: ['m_mixradius'],
  UMUM: ['m_partners']
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
export const ACTIONS = ['read', 'create', 'update', 'delete', 'site_only', 'department_only', 'cancel', 'verify', 'reminder', 'approve_request', 'calculate', 'audit', 'approve', 'mark_paid'] as const

/**
 * Granular Permissions untuk operasi sensitif
 * 
 * Format: `resource:action:subaction`
 * 
 * Permissions ini digunakan untuk kontrol lebih detail pada operasi
 * yang memerlukan hak akses khusus (privilege escalation prevention).
 * 
 * @example
 * ```typescript
 * // Check if user can update someone's role
 * const canUpdateRole = permissions.includes('users:update:role')
 * ```
 */
export const GRANULAR_PERMISSIONS = {
  // User sensitive operations
  USERS_UPDATE_ROLE: 'users:update:role',           // Update user role assignment
  USERS_UPDATE_SITE: 'users:update:site',           // Update user site assignment
  USERS_UPDATE_DEPARTMENT: 'users:update:department', // Update user department assignment
  USERS_UPDATE_STATUS: 'users:update:status',       // Update user active status (enable/disable)
  USERS_ASSIGN_SUPER_ADMIN: 'users:assign_super_admin', // Assign SUPER_ADMIN role to users

  // Work order sensitive operations
  WORKORDERS_REASSIGN: 'workorders:update:assign',  // Reassign work order to different technician
  WORKORDERS_CLOSE: 'workorders:update:close',      // Close/complete work order
  WORKORDERS_REMINDER: 'workorders:reminder',       // Send manual reminder notification
  WORKORDERS_REQUESTS_READ: 'workorders:requests:read',       // View WO requests from mobile
  WORKORDERS_REQUESTS_APPROVE: 'workorders:requests:approve', // Approve/reject WO requests

  // Inventory sensitive operations
  INVENTORY_ADJUST: 'inventory:update:adjust',      // Adjust inventory quantity (stock opname)
  INVENTORY_TRANSFER: 'inventory:update:transfer',  // Transfer inventory between gudang

  // Finance sensitive operations
  FINANCE_VOID: 'finance:update:void',              // Void/cancel financial transactions
  FINANCE_APPROVE: 'finance:update:approve',        // Approve expense/income entries

  // Salary/Gaji sensitive operations
  SALARY_CALCULATE: 'salary:calculate',             // Calculate salaries
  SALARY_AUDIT: 'salary:audit',                     // Audit salary records
  SALARY_APPROVE: 'salary:approve',                 // Final approval for salary
  SALARY_MARK_PAID: 'salary:mark_paid',             // Mark salary as paid
  SALARY_VIEW_ALL: 'salary:view_all',               // View all salary records (bypass privacy)
} as const

export type GranularPermission = typeof GRANULAR_PERMISSIONS[keyof typeof GRANULAR_PERMISSIONS]

/**
 * Get list of all granular permission values for seeding
 */
export function getAllGranularPermissions(): string[] {
  return Object.values(GRANULAR_PERMISSIONS)
}

