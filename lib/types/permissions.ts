/**
 * Permission Types for Granular Role-Based Access Control
 * 
 * This module defines the types for the permission matrix system
 * that allows configuring read/create/update/delete access per feature/menu.
 */

/**
 * Available permission actions
 */
export type PermissionAction = 'read' | 'create' | 'update' | 'delete'

/**
 * Permission configuration for a single feature
 */
export interface FeaturePermission {
    read: boolean
    create?: boolean
    update?: boolean
    delete?: boolean
}

/**
 * Permission matrix - maps feature codes to their permissions
 * 
 * Example:
 * {
 *   "PELANGGAN": { "read": true, "create": true, "update": true, "delete": false },
 *   "PELANGGAN.TAGIHAN": { "read": true, "create": false },
 *   "FINANCE": { "read": true, "create": true, "update": true, "delete": true }
 * }
 */
export interface PermissionMatrix {
    [featureCode: string]: FeaturePermission
}

/**
 * Menu item with resolved permissions
 */
export interface MenuItem {
    code: string
    name: string
    path?: string
    icon?: string
    portal: string
    sortOrder: number
    children?: MenuItem[]
    permissions?: FeaturePermission
}

/**
 * Menu definition from database
 */
export interface MenuDefinitionData {
    id: string
    code: string
    name: string
    parentCode: string | null
    path: string | null
    icon: string | null
    defaultPerms: FeaturePermission | null
    sortOrder: number
    isActive: boolean
    portal: string
}

/**
 * Default full access permissions
 */
export const FULL_ACCESS: FeaturePermission = {
    read: true,
    create: true,
    update: true,
    delete: true,
}

/**
 * Default read-only permissions
 */
export const READ_ONLY: FeaturePermission = {
    read: true,
    create: false,
    update: false,
    delete: false,
}

/**
 * All available feature codes in the system
 */
export const ALL_FEATURE_CODES = [
    // Admin Portal - Top Level
    'DASHBOARD',
    'ROLES',
    'NETWORK',
    'FTTH',
    'PAKET',
    'PELANGGAN',
    'INVENTORY',
    'USERS',
    'HELPDESK',
    'WORKORDERS',
    'HRIS',
    'FINANCE',
    'PENGATURAN',

    // Network submenus
    'NETWORK.OLT',
    'NETWORK.ROUTER',

    // FTTH submenus
    'FTTH.OTB',
    'FTTH.ODC',
    'FTTH.ODP',
    'FTTH.JOINBOX',
    'FTTH.POLE',
    'FTTH.MAP',

    // Pelanggan submenus
    'PELANGGAN.DAFTAR',
    'PELANGGAN.TAGIHAN',

    // Inventory submenus
    'INVENTORY.BARANG',
    'INVENTORY.MASUK',
    'INVENTORY.KELUAR',
    'INVENTORY.KATEGORI',

    // HRIS submenus
    'HRIS.EMPLOYEES',
    'HRIS.DEPARTMENTS',
    'HRIS.ATTENDANCE',
    'HRIS.PAYROLL',
    'HRIS.LEAVE',

    // Finance submenus
    'FINANCE.PEMASUKAN',
    'FINANCE.PENGELUARAN',
    'FINANCE.BANK',
    'FINANCE.LAPORAN',
    'FINANCE.BUDGET',

    // Pengaturan submenus
    'PENGATURAN.PROFILE',
    'PENGATURAN.PAYMENT',
    'PENGATURAN.OAUTH',

    // Employee Portal
    'EMPLOYEE.DASHBOARD',
    'EMPLOYEE.ABSENSI',
    'EMPLOYEE.INVENTORY',
    'EMPLOYEE.PROFILE',

    // Finance Portal
    'FINANCE_PORTAL.DASHBOARD',
    'FINANCE_PORTAL.TAGIHAN',
    'FINANCE_PORTAL.PEMASUKAN',
    'FINANCE_PORTAL.PENGELUARAN',
    'FINANCE_PORTAL.LAPORAN',
] as const

export type FeatureCode = typeof ALL_FEATURE_CODES[number]
