/**
 * Resource Capabilities Configuration
 * 
 * Menentukan actions apa yang tersedia untuk setiap resource.
 * Digunakan oleh Role Matrix UI untuk filter checkbox yang ditampilkan.
 * 
 * Actions:
 * - read: Melihat/membaca data
 * - create: Membuat data baru
 * - update: Mengubah data yang ada  
 * - delete: Menghapus data
 * - site_only: Restricsi hanya data site sendiri
 * - department_only: Restricsi hanya data department sendiri
 * - cancel: Membatalkan (khusus Work Order)
 * - verify: Memverifikasi (khusus Work Order)
 */

export type ResourceAction = 'read' | 'create' | 'update' | 'delete' | 'site_only' | 'department_only' | 'cancel' | 'verify'

export interface ResourceCapability {
    actions: ResourceAction[]
    description?: string
}

/**
 * Resource capabilities mapping
 * Key: resource name (lowercase)
 * Value: available actions for that resource
 */
export const RESOURCE_CAPABILITIES: Record<string, ResourceCapability> = {
    // ====== READ-ONLY RESOURCES ======
    // Hanya bisa lihat data, tidak ada CRUD
    dashboard: {
        actions: ['read', 'site_only'],
        description: 'Dashboard utama admin portal'
    },
    work_order_dashboard: {
        actions: ['read', 'site_only', 'department_only'],
        description: 'Dashboard Work Order'
    },
    live_tracking: {
        actions: ['read', 'site_only', 'department_only'],
        description: 'Live tracking lokasi karyawan'
    },
    system_log: {
        actions: ['read', 'site_only'],
        description: 'Log aktivitas sistem'
    },
    report: {
        actions: ['read', 'site_only', 'department_only'],
        description: 'Laporan kehadiran'
    },
    daily_income: {
        actions: ['read', 'site_only'],
        description: 'Pendapatan harian'
    },
    period_income: {
        actions: ['read', 'site_only'],
        description: 'Pendapatan periodik'
    },
    profit_loss: {
        actions: ['read', 'site_only'],
        description: 'Laporan rugi laba'
    },
    
    // ====== KEHADIRAN MODULE ======
    attendance: {
        actions: ['read', 'create', 'update', 'delete', 'site_only', 'department_only'],
        description: 'Data kehadiran karyawan'
    },
    izin: {
        actions: ['read', 'create', 'update', 'delete', 'verify', 'site_only', 'department_only'],
        description: 'Pengajuan izin/cuti'
    },
    lembur: {
        actions: ['read', 'create', 'update', 'delete', 'verify', 'site_only', 'department_only'],
        description: 'Data lembur karyawan'
    },
    holiday: {
        actions: ['read', 'create', 'update', 'delete', 'site_only'],
        description: 'Hari libur nasional/perusahaan'
    },
    
    // ====== INVENTORY MODULE ======
    barang: {
        actions: ['read', 'create', 'update', 'delete', 'site_only', 'department_only'],
        description: 'Master barang inventory'
    },
    gudang: {
        actions: ['read', 'create', 'update', 'delete', 'site_only', 'department_only'],
        description: 'Master gudang/warehouse'
    },
    masuk: {
        actions: ['read', 'create', 'update', 'delete', 'site_only', 'department_only'],
        description: 'Barang masuk'
    },
    keluar: {
        actions: ['read', 'create', 'update', 'delete', 'site_only', 'department_only'],
        description: 'Barang keluar'
    },
    transfer: {
        actions: ['read', 'create', 'update', 'delete', 'site_only', 'department_only'],
        description: 'Transfer antar gudang'
    },
    opname: {
        actions: ['read', 'create', 'update', 'delete', 'site_only', 'department_only'],
        description: 'Stock opname'
    },
    restock: {
        actions: ['read', 'create', 'update', 'delete', 'site_only'],
        description: 'Request restock'
    },
    inventory: {
        actions: ['read', 'create', 'update', 'delete', 'site_only', 'department_only'],
        description: 'Menu inventory (parent)'
    },
    
    // ====== WORK ORDER MODULE ======
    workorders: {
        actions: ['read', 'create', 'update', 'delete', 'cancel', 'verify', 'site_only', 'department_only'],
        description: 'Work Order'
    },
    list: {
        actions: ['read', 'create', 'update', 'delete', 'cancel', 'verify', 'site_only', 'department_only'],
        description: 'Daftar Work Order'
    },
    
    // ====== USERS & ROLES ======
    users: {
        actions: ['read', 'create', 'update', 'delete', 'site_only'],
        description: 'Manajemen pengguna'
    },
    roles: {
        actions: ['read', 'create', 'update', 'delete'],
        description: 'Manajemen role'
    },
    department: {
        actions: ['read', 'create', 'update', 'delete', 'site_only'],
        description: 'Manajemen department'
    },
    site: {
        actions: ['read', 'create', 'update', 'delete'],
        description: 'Manajemen site'
    },
    
    // ====== NETWORK ======
    network: {
        actions: ['read', 'create', 'update', 'delete', 'site_only'],
        description: 'Menu network (parent)'
    },
    mikrotik: {
        actions: ['read', 'create', 'update', 'delete', 'site_only'],
        description: 'MikroTik routers'
    },
    radius: {
        actions: ['read', 'create', 'update', 'delete', 'site_only'],
        description: 'Radius server'
    },
    olt: {
        actions: ['read', 'create', 'update', 'delete', 'site_only'],
        description: 'OLT devices'
    },
    onu: {
        actions: ['read', 'create', 'update', 'delete', 'site_only'],
        description: 'ONU devices'
    },
    
    // ====== PELANGGAN ======
    pelanggan: {
        actions: ['read', 'create', 'update', 'delete', 'site_only'],
        description: 'Data pelanggan'
    },
    
    // ====== SETTINGS ======
    umum: {
        actions: ['read', 'update'],
        description: 'Pengaturan umum'
    },
    logo: {
        actions: ['read', 'update'],
        description: 'Logo perusahaan'
    },
    email: {
        actions: ['read', 'update'],
        description: 'Pengaturan email'
    },
    whatsapp: {
        actions: ['read', 'update'],
        description: 'Pengaturan WhatsApp'
    },
    payment_gateway: {
        actions: ['read', 'update'],
        description: 'Pengaturan payment gateway'
    },
    api: {
        actions: ['read', 'create', 'update', 'delete'],
        description: 'API keys'
    },
    nada_dering: {
        actions: ['read'],
        description: 'Pengaturan nada dering notifikasi'
    },
    
    // ====== OTHERS ======
    announcement: {
        actions: ['read', 'create', 'update', 'delete', 'site_only'],
        description: 'Pengumuman'
    },
    support: {
        actions: ['read', 'create', 'update', 'delete', 'site_only'],
        description: 'Support tickets'
    },
    finance: {
        actions: ['read', 'site_only'],
        description: 'Menu finance (parent)'
    },
    expense: {
        actions: ['read', 'create', 'update', 'delete', 'site_only'],
        description: 'Pengeluaran'
    },
    
    // ====== CHAT MODULE ======
    chat: {
        actions: ['read', 'create'],
        description: 'Fitur chat untuk komunikasi - read: baca pesan, create: kirim pesan'
    },
    broadcast: {
        actions: ['create'],
        description: 'Kirim broadcast ke semua users'
    },

    // ====== APP VERSION ======
    app_version: {
        actions: ['read', 'create', 'update', 'delete'],
        description: 'Manajemen versi aplikasi mobile'
    },
}

/**
 * Get available actions for a resource
 * Falls back to all actions if resource not configured
 */
export function getResourceCapabilities(resource: string): ResourceAction[] {
    const capability = RESOURCE_CAPABILITIES[resource.toLowerCase()]
    if (capability) {
        return capability.actions
    }
    // Default: all actions available
    return ['read', 'create', 'update', 'delete', 'site_only', 'department_only']
}

/**
 * Check if an action is available for a resource
 */
export function isActionAvailable(resource: string, action: ResourceAction): boolean {
    const capabilities = getResourceCapabilities(resource)
    return capabilities.includes(action)
}

/**
 * Filter actions based on resource capabilities
 */
export function filterAvailableActions(resource: string, actions: ResourceAction[]): ResourceAction[] {
    const capabilities = getResourceCapabilities(resource)
    return actions.filter(action => capabilities.includes(action))
}
