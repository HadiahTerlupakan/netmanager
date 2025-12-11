/**
 * Seed Menu Definitions
 * 
 * This script seeds the MenuDefinition table with all available menus and submenus
 * Run with: npx ts-node scripts/seed-menu-definitions.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface MenuSeed {
    code: string
    name: string
    parentCode?: string
    path?: string
    icon?: string
    sortOrder: number
    portal: string
    defaultPerms: {
        read: boolean
        create: boolean
        update: boolean
        delete: boolean
    }
}

const menuDefinitions: MenuSeed[] = [
    // =============================================
    // ADMIN PORTAL - TOP LEVEL MENUS
    // =============================================
    {
        code: 'DASHBOARD',
        name: 'Dashboard',
        path: '/admin',
        icon: 'LayoutDashboard',
        sortOrder: 0,
        portal: 'admin',
        defaultPerms: { read: true, create: false, update: false, delete: false },
    },
    {
        code: 'ROLES',
        name: 'Manajemen Role',
        path: '/admin/roles',
        icon: 'Shield',
        sortOrder: 5,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'NETWORK',
        name: 'Network',
        icon: 'Network',
        sortOrder: 10,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'FTTH',
        name: 'FTTH',
        icon: 'Cable',
        sortOrder: 20,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'PAKET',
        name: 'Paket',
        path: '/admin/paket',
        icon: 'Package',
        sortOrder: 30,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'PELANGGAN',
        name: 'Pelanggan',
        icon: 'Users',
        sortOrder: 40,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'INVENTORY',
        name: 'Inventory',
        icon: 'Package',
        sortOrder: 50,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'USERS',
        name: 'Manajemen Akun', // Was: Users
        path: '/admin/users',
        icon: 'UserCog',
        sortOrder: 60,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'HELPDESK',
        name: 'Helpdesk',
        path: '/admin/helpdesk',
        icon: 'Headphones',
        sortOrder: 70,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'WORKORDERS',
        name: 'Work Orders',
        path: '/admin/workorders',
        icon: 'ClipboardList',
        sortOrder: 80,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'HRIS',
        name: 'HRIS',
        icon: 'UserCheck',
        sortOrder: 90,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'FINANCE',
        name: 'Finance',
        icon: 'DollarSign',
        sortOrder: 100,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'PENGATURAN',
        name: 'Pengaturan',
        icon: 'Settings',
        sortOrder: 110,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },

    // =============================================
    // NETWORK SUBMENUS
    // =============================================
    {
        code: 'NETWORK.OLT',
        name: 'OLT Management',
        parentCode: 'NETWORK',
        path: '/admin/network/olt',
        sortOrder: 0,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'NETWORK.ROUTER',
        name: 'Router Management',
        parentCode: 'NETWORK',
        path: '/admin/network/router',
        sortOrder: 10,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },

    // =============================================
    // FTTH SUBMENUS
    // =============================================
    {
        code: 'FTTH.OTB',
        name: 'OTB',
        parentCode: 'FTTH',
        path: '/admin/ftth/otb',
        sortOrder: 0,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'FTTH.ODC',
        name: 'ODC',
        parentCode: 'FTTH',
        path: '/admin/ftth/odc',
        sortOrder: 10,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'FTTH.ODP',
        name: 'ODP',
        parentCode: 'FTTH',
        path: '/admin/ftth/odp',
        sortOrder: 20,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'FTTH.JOINBOX',
        name: 'Joinbox',
        parentCode: 'FTTH',
        path: '/admin/ftth/joinbox',
        sortOrder: 30,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'FTTH.POLE',
        name: 'Pole',
        parentCode: 'FTTH',
        path: '/admin/ftth/pole',
        sortOrder: 40,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'FTTH.MAP',
        name: 'Network Map',
        parentCode: 'FTTH',
        path: '/admin/ftth/map',
        sortOrder: 50,
        portal: 'admin',
        defaultPerms: { read: true, create: false, update: false, delete: false },
    },

    // =============================================
    // PELANGGAN SUBMENUS
    // =============================================
    {
        code: 'PELANGGAN.DAFTAR',
        name: 'Daftar Pelanggan',
        parentCode: 'PELANGGAN',
        path: '/admin/pelanggan',
        sortOrder: 0,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'PELANGGAN.TAGIHAN',
        name: 'Tagihan',
        parentCode: 'PELANGGAN',
        path: '/admin/pelanggan/tagihan',
        sortOrder: 10,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },

    // =============================================
    // INVENTORY SUBMENUS
    // =============================================
    {
        code: 'INVENTORY.BARANG',
        name: 'Daftar Barang',
        parentCode: 'INVENTORY',
        path: '/admin/inventory',
        sortOrder: 0,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'INVENTORY.MASUK',
        name: 'Barang Masuk',
        parentCode: 'INVENTORY',
        path: '/admin/inventory/masuk',
        sortOrder: 10,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },
    {
        code: 'INVENTORY.KELUAR',
        name: 'Barang Keluar',
        parentCode: 'INVENTORY',
        path: '/admin/inventory/keluar',
        sortOrder: 20,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },
    {
        code: 'INVENTORY.KATEGORI',
        name: 'Kategori',
        parentCode: 'INVENTORY',
        path: '/admin/inventory/kategori',
        sortOrder: 30,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },

    // =============================================
    // HRIS SUBMENUS
    // =============================================
    {
        code: 'HRIS.EMPLOYEES',
        name: 'Karyawan',
        parentCode: 'HRIS',
        path: '/admin/hris/employees',
        sortOrder: 0,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'HRIS.DEPARTMENTS',
        name: 'Departemen',
        parentCode: 'HRIS',
        path: '/admin/hris/departments',
        sortOrder: 10,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'HRIS.ATTENDANCE',
        name: 'Absensi',
        parentCode: 'HRIS',
        path: '/admin/hris/attendance',
        sortOrder: 20,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },
    {
        code: 'HRIS.PAYROLL',
        name: 'Payroll',
        parentCode: 'HRIS',
        path: '/admin/hris/payroll',
        sortOrder: 30,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },
    {
        code: 'HRIS.LEAVE',
        name: 'Cuti',
        parentCode: 'HRIS',
        path: '/admin/hris/leave',
        sortOrder: 40,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },

    // =============================================
    // FINANCE SUBMENUS
    // =============================================
    {
        code: 'FINANCE.PEMASUKAN',
        name: 'Pemasukan',
        parentCode: 'FINANCE',
        path: '/admin/finance/pemasukan',
        sortOrder: 0,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },
    {
        code: 'FINANCE.PENGELUARAN',
        name: 'Pengeluaran',
        parentCode: 'FINANCE',
        path: '/admin/finance/pengeluaran',
        sortOrder: 10,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },
    {
        code: 'FINANCE.BANK',
        name: 'Rekening Bank',
        parentCode: 'FINANCE',
        path: '/admin/finance/bank',
        sortOrder: 20,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'FINANCE.LAPORAN',
        name: 'Laporan Keuangan',
        parentCode: 'FINANCE',
        path: '/admin/finance/laporan',
        sortOrder: 30,
        portal: 'admin',
        defaultPerms: { read: true, create: false, update: false, delete: false },
    },
    {
        code: 'FINANCE.BUDGET',
        name: 'Anggaran',
        parentCode: 'FINANCE',
        path: '/admin/finance/budget',
        sortOrder: 40,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },

    // =============================================
    // PENGATURAN SUBMENUS
    // =============================================
    {
        code: 'PENGATURAN.PROFILE',
        name: 'Profil Perusahaan',
        parentCode: 'PENGATURAN',
        path: '/admin/pengaturan/profile',
        sortOrder: 0,
        portal: 'admin',
        defaultPerms: { read: true, create: false, update: true, delete: false },
    },
    {
        code: 'PENGATURAN.PAYMENT',
        name: 'Payment Gateway',
        parentCode: 'PENGATURAN',
        path: '/admin/pengaturan/payment',
        sortOrder: 10,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'PENGATURAN.OAUTH',
        name: 'OAuth Provider',
        parentCode: 'PENGATURAN',
        path: '/admin/pengaturan/oauth',
        sortOrder: 20,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },

    // =============================================
    // EMPLOYEE PORTAL
    // =============================================
    {
        code: 'EMPLOYEE.DASHBOARD',
        name: 'Dashboard',
        path: '/employee',
        icon: 'LayoutDashboard',
        sortOrder: 0,
        portal: 'employee',
        defaultPerms: { read: true, create: false, update: false, delete: false },
    },
    {
        code: 'EMPLOYEE.ABSENSI',
        name: 'Absensi',
        path: '/employee/absensi',
        icon: 'Clock',
        sortOrder: 10,
        portal: 'employee',
        defaultPerms: { read: true, create: true, update: false, delete: false },
    },
    {
        code: 'EMPLOYEE.INVENTORY',
        name: 'Inventory',
        path: '/employee/inventory',
        icon: 'Package',
        sortOrder: 20,
        portal: 'employee',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },
    {
        code: 'EMPLOYEE.PROFILE',
        name: 'Profil Saya',
        path: '/employee/profile',
        icon: 'User',
        sortOrder: 30,
        portal: 'employee',
        defaultPerms: { read: true, create: false, update: true, delete: false },
    },

    // =============================================
    // FINANCE PORTAL
    // =============================================
    {
        code: 'FINANCE_PORTAL.DASHBOARD',
        name: 'Dashboard',
        path: '/finance',
        icon: 'LayoutDashboard',
        sortOrder: 0,
        portal: 'finance',
        defaultPerms: { read: true, create: false, update: false, delete: false },
    },
    {
        code: 'FINANCE_PORTAL.TAGIHAN',
        name: 'Tagihan Pelanggan',
        path: '/finance/tagihan',
        icon: 'Receipt',
        sortOrder: 10,
        portal: 'finance',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },
    {
        code: 'FINANCE_PORTAL.PEMASUKAN',
        name: 'Pemasukan',
        path: '/finance/pemasukan',
        icon: 'TrendingUp',
        sortOrder: 20,
        portal: 'finance',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },
    {
        code: 'FINANCE_PORTAL.PENGELUARAN',
        name: 'Pengeluaran',
        path: '/finance/pengeluaran',
        icon: 'TrendingDown',
        sortOrder: 30,
        portal: 'finance',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },
    {
        code: 'FINANCE_PORTAL.LAPORAN',
        name: 'Laporan',
        path: '/finance/laporan',
        icon: 'FileText',
        sortOrder: 40,
        portal: 'finance',
        defaultPerms: { read: true, create: false, update: false, delete: false },
    },
]

async function main() {
    console.log('🌱 Seeding menu definitions...')

    for (const menu of menuDefinitions) {
        await prisma.menuDefinition.upsert({
            where: { code: menu.code },
            update: {
                name: menu.name,
                parentCode: menu.parentCode || null,
                path: menu.path || null,
                icon: menu.icon || null,
                defaultPerms: menu.defaultPerms,
                sortOrder: menu.sortOrder,
                portal: menu.portal,
            },
            create: {
                code: menu.code,
                name: menu.name,
                parentCode: menu.parentCode || null,
                path: menu.path || null,
                icon: menu.icon || null,
                defaultPerms: menu.defaultPerms,
                sortOrder: menu.sortOrder,
                portal: menu.portal,
            },
        })
        console.log(`  ✓ ${menu.code}`)
    }

    console.log(`\n✅ Successfully seeded ${menuDefinitions.length} menu definitions!`)
}

main()
    .catch((e) => {
        console.error('❌ Error seeding menu definitions:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

export { menuDefinitions }
