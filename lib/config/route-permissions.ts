import type { FeatureCode } from '@/lib/types/permissions'

export const ROUTE_PERMISSIONS: Record<string, FeatureCode> = {
    // Top Level Modules
    '/admin/finance': 'FINANCE',
    '/admin/ftth': 'FTTH',
    '/admin/helpdesk': 'HELPDESK',
    '/admin/hris': 'HRIS',
    '/admin/inventory': 'INVENTORY',
    '/admin/network': 'NETWORK',
    '/admin/paket': 'PAKET',
    '/admin/pelanggan': 'PELANGGAN',
    '/admin/pengaturan': 'PENGATURAN',
    '/admin/users': 'USERS',
    '/admin/roles': 'ROLES',
    '/admin/workorders': 'WORKORDERS',

    // Specific Sub-functions (examples, can be expanded)
    '/admin/pelanggan/tagihan': 'PELANGGAN.TAGIHAN',
    '/admin/finance/pemasukan': 'FINANCE.PEMASUKAN',
    '/admin/finance/pengeluaran': 'FINANCE.PENGELUARAN',
    '/admin/finance/laporan': 'FINANCE.LAPORAN',
    '/admin/finance/budget': 'FINANCE.BUDGET',
    '/admin/hris/employees': 'HRIS.EMPLOYEES',
    '/admin/hris/attendance': 'HRIS.ATTENDANCE',
    '/admin/hris/payroll': 'HRIS.PAYROLL',
    '/admin/network/olt': 'NETWORK.OLT',
    '/admin/network/router': 'NETWORK.ROUTER',

    // Employee Portal Routes
    '/employee/attendance': 'EMPLOYEE.ABSENSI',
    '/employee/leaves': 'EMPLOYEE.CUTI',
    '/employee/inventory': 'EMPLOYEE.INVENTORY',
    '/employee/workorders': 'EMPLOYEE.WORKORDERS',
    '/employee/payslips': 'EMPLOYEE.PAYSLIPS',
}

// Routes that are always allowed for authenticated users
export const PUBLIC_ROUTES = [
    '/login',
    '/register',
    '/error',
    '/api/auth',
]

export const DEFAULT_REDIRECT = '/admin'
