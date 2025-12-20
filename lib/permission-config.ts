export const PERMISSION_GROUPS = {
    DASHBOARD: ['dashboard'],
    NETWORK: ['network', 'mikrotik', 'radius', 'olt', 'onu', 'onutype', 'speedprofile', 'vlan'],
    FTTH: ['ftth', 'otb', 'odc', 'odp', 'closure', 'pole', 'kmz', 'map'],
    PAKET: ['paket', 'bandwidth', 'profileppp', 'harga'],
    PELANGGAN: ['pelanggan', 'ppp', 'registration'],
    INVENTORY: ['inventory', 'barang', 'masuk', 'keluar', 'transfer', 'restock', 'opname', 'gudang'],
    WORKORDERS: ['work_order_dashboard', 'list', 'site', 'department'],
    ATTENDANCE: ['attendance', 'report', 'lembur'],
    FINANCE: ['finance', 'daily_income', 'period_income', 'expense', 'profit_loss'],
    PENGATURAN: ['pengaturan', 'general', 'logo', 'email', 'whatsapp', 'roles', 'payment_gateway', 'api'],
    SYSTEM_LOG: ['log', 'login', 'activity'],
    SUPPORT: ['support'],
    ANNOUNCEMENT: ['announcement'],
    USERS: ['user'],

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
export const ACTIONS = ['read', 'create', 'update', 'delete'] as const
