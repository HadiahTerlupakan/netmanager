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
        name: 'Manajemen Akun',
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
        code: 'NETWORK.ONU',
        name: 'ONU Management',
        parentCode: 'NETWORK',
        path: '/admin/network/onu',
        sortOrder: 10,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'NETWORK.ONUTYPE',
        name: 'ONU Type',
        parentCode: 'NETWORK',
        path: '/admin/network/onutype',
        sortOrder: 20,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'NETWORK.SPEEDPROFILES',
        name: 'Speed Profiles',
        parentCode: 'NETWORK',
        path: '/admin/network/speedprofiles',
        sortOrder: 30,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'NETWORK.VLAN',
        name: 'VLAN',
        parentCode: 'NETWORK',
        path: '/admin/network/vlan',
        sortOrder: 40,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'NETWORK.MIKROTIK',
        name: 'Mikrotik',
        parentCode: 'NETWORK',
        path: '/admin/network/mikrotik',
        sortOrder: 50,
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
        path: '/admin/inventory/barang',
        sortOrder: 0,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'INVENTORY.GUDANG',
        name: 'Gudang',
        parentCode: 'INVENTORY',
        path: '/admin/inventory/gudang',
        sortOrder: 5,
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
        code: 'INVENTORY.TRANSFER',
        name: 'Transfer Barang',
        parentCode: 'INVENTORY',
        path: '/admin/inventory/transfer',
        sortOrder: 25,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },
    {
        code: 'INVENTORY.OPNAME',
        name: 'Stock Opname',
        parentCode: 'INVENTORY',
        path: '/admin/inventory/opname',
        sortOrder: 30,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },
    {
        code: 'INVENTORY.RESTOCK',
        name: 'Restock Alert',
        parentCode: 'INVENTORY',
        path: '/admin/inventory/restock',
        sortOrder: 35,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: false },
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
        code: 'HRIS.SITES',
        name: 'Sites/Lokasi',
        parentCode: 'HRIS',
        path: '/admin/hris/sites',
        sortOrder: 15,
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
        path: '/admin/hris/leaves',
        sortOrder: 40,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },

    // =============================================
    // FINANCE SUBMENUS
    // =============================================
    {
        code: 'FINANCE.TAGIHAN',
        name: 'Tagihan',
        parentCode: 'FINANCE',
        path: '/admin/finance/tagihan',
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
        path: '/admin/finance/bank-accounts',
        sortOrder: 20,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'FINANCE.CASHFLOW',
        name: 'Cashflow',
        parentCode: 'FINANCE',
        path: '/admin/finance/cashflow',
        sortOrder: 30,
        portal: 'admin',
        defaultPerms: { read: true, create: false, update: false, delete: false },
    },
    {
        code: 'FINANCE.MANUAL_PAYMENTS',
        name: 'Pembayaran Manual',
        parentCode: 'FINANCE',
        path: '/admin/finance/manual-payments',
        sortOrder: 40,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },

    // =============================================
    // PENGATURAN SUBMENUS
    // =============================================
    {
        code: 'PENGATURAN.UMUM',
        name: 'Umum',
        parentCode: 'PENGATURAN',
        path: '/admin/pengaturan/umum',
        sortOrder: 0,
        portal: 'admin',
        defaultPerms: { read: true, create: false, update: true, delete: false },
    },
    {
        code: 'PENGATURAN.LOGO',
        name: 'Logo',
        parentCode: 'PENGATURAN',
        path: '/admin/pengaturan/logo',
        sortOrder: 5,
        portal: 'admin',
        defaultPerms: { read: true, create: false, update: true, delete: false },
    },
    {
        code: 'PENGATURAN.EMAIL',
        name: 'Email',
        parentCode: 'PENGATURAN',
        path: '/admin/pengaturan/email',
        sortOrder: 10,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'PENGATURAN.WHATSAPP',
        name: 'WhatsApp',
        parentCode: 'PENGATURAN',
        path: '/admin/pengaturan/whatsapp',
        sortOrder: 15,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'PENGATURAN.PAYMENT',
        name: 'Payment Gateway',
        parentCode: 'PENGATURAN',
        path: '/admin/pengaturan/payment-gateway',
        sortOrder: 20,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'PENGATURAN.BANK',
        name: 'Rekening Perusahaan',
        parentCode: 'PENGATURAN',
        path: '/admin/pengaturan/company-bank-accounts',
        sortOrder: 25,
        portal: 'admin',
        defaultPerms: { read: true, create: true, update: true, delete: true },
    },
    {
        code: 'PENGATURAN.OAUTH',
        name: 'OAuth Provider',
        parentCode: 'PENGATURAN',
        path: '/admin/pengaturan/oauth',
        sortOrder: 30,
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
        path: '/employee/attendance',
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
        code: 'EMPLOYEE.WORKORDERS',
        name: 'Work Orders',
        path: '/employee/workorders',
        icon: 'ClipboardList',
        sortOrder: 25,
        portal: 'employee',
        defaultPerms: { read: true, create: false, update: true, delete: false },
    },
    {
        code: 'EMPLOYEE.LEAVES',
        name: 'Cuti',
        path: '/employee/leaves',
        icon: 'Calendar',
        sortOrder: 30,
        portal: 'employee',
        defaultPerms: { read: true, create: true, update: false, delete: false },
    },
    {
        code: 'EMPLOYEE.PAYSLIPS',
        name: 'Slip Gaji',
        path: '/employee/payslips',
        icon: 'Receipt',
        sortOrder: 35,
        portal: 'employee',
        defaultPerms: { read: true, create: false, update: false, delete: false },
    },
    {
        code: 'EMPLOYEE.PROFILE',
        name: 'Profil Saya',
        path: '/employee/profile',
        icon: 'User',
        sortOrder: 40,
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
        code: 'FINANCE_PORTAL.PENGELUARAN',
        name: 'Pengeluaran',
        path: '/finance/pengeluaran',
        icon: 'TrendingDown',
        sortOrder: 20,
        portal: 'finance',
        defaultPerms: { read: true, create: true, update: true, delete: false },
    },
    {
        code: 'FINANCE_PORTAL.LAPORAN',
        name: 'Laporan',
        path: '/finance/laporan',
        icon: 'FileText',
        sortOrder: 30,
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
