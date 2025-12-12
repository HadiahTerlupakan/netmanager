#!/usr/bin/env ts-node
/**
 * Auto-Discovery Menu Definitions
 * 
 * This script automatically scans the app directory structure
 * and syncs menu definitions to the database.
 * 
 * Run with: npx ts-node scripts/sync-menu-definitions.ts
 * 
 * Features:
 * - Auto-discovers routes from app/admin, app/employee, app/finance
 * - Skips dynamic routes ([id], [slug], etc.)
 * - Skips API routes and special Next.js folders
 * - Preserves existing manual configurations
 * - Uses folder names to generate display names
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface DiscoveredMenu {
    code: string
    name: string
    parentCode: string | null
    path: string
    sortOrder: number
    portal: string
}

// Folders to skip during discovery
const SKIP_FOLDERS = [
    'api',           // API routes
    'components',    // Components folder
    'loading.tsx',   // Loading states  
    'error.tsx',     // Error states
    'layout.tsx',    // Layouts
    'not-found.tsx', // 404
    'debug-permissions', // Debug
]

// Display name mappings (folder name -> display name)
const NAME_MAPPINGS: Record<string, string> = {
    'olt': 'OLT Management',
    'onu': 'ONU Management',
    'onutype': 'ONU Type',
    'odp': 'ODP',
    'odc': 'ODC',
    'otb': 'OTB',
    'ftth': 'FTTH',
    'hris': 'HRIS',
    'mikrotik': 'Mikrotik',
    'vlan': 'VLAN',
    'speedprofiles': 'Speed Profiles',
    'pelanggan': 'Pelanggan',
    'inventory': 'Inventory',
    'workorders': 'Work Orders',
    'helpdesk': 'Helpdesk',
    'pengaturan': 'Pengaturan',
    'paket': 'Paket',
    'barang': 'Daftar Barang',
    'gudang': 'Gudang',
    'masuk': 'Barang Masuk',
    'keluar': 'Barang Keluar',
    'transfer': 'Transfer Barang',
    'opname': 'Stock Opname',
    'restock': 'Restock Alert',
    'employees': 'Karyawan',
    'departments': 'Departemen',
    'sites': 'Sites/Lokasi',
    'attendance': 'Absensi',
    'payroll': 'Payroll',
    'leaves': 'Cuti',
    'tagihan': 'Tagihan',
    'pengeluaran': 'Pengeluaran',
    'bank-accounts': 'Rekening Bank',
    'cashflow': 'Cashflow',
    'manual-payments': 'Pembayaran Manual',
    'umum': 'Umum',
    'logo': 'Logo Perusahaan',
    'email': 'Email',
    'whatsapp': 'WhatsApp',
    'payment-gateway': 'Payment Gateway',
    'company-bank-accounts': 'Rekening Perusahaan',
    'oauth': 'OAuth Provider',
    'users': 'Manajemen Akun',
    'roles': 'Manajemen Role',
    'profile': 'Profil',
    'payslips': 'Slip Gaji',
    'notifications': 'Notifikasi',
    'joinbox': 'Joinbox',
    'pole': 'Pole',
    'map': 'Network Map',
    'radius': 'RADIUS',
    'network': 'Network',
    'finance': 'Finance',
}

// Icon mappings
const ICON_MAPPINGS: Record<string, string> = {
    'dashboard': 'LayoutDashboard',
    'pelanggan': 'Users',
    'network': 'Network',
    'ftth': 'Cable',
    'paket': 'Package',
    'inventory': 'Package',
    'users': 'UserCog',
    'roles': 'Shield',
    'helpdesk': 'Headphones',
    'workorders': 'ClipboardList',
    'hris': 'UserCheck',
    'finance': 'DollarSign',
    'pengaturan': 'Settings',
    'attendance': 'Clock',
    'profile': 'User',
    'leaves': 'Calendar',
    'payslips': 'Receipt',
    'notifications': 'Bell',
}

function isDynamicRoute(folderName: string): boolean {
    return folderName.startsWith('[') && folderName.endsWith(']')
}

function shouldSkip(folderName: string): boolean {
    return SKIP_FOLDERS.includes(folderName) ||
        folderName.startsWith('_') ||
        folderName.startsWith('.') ||
        isDynamicRoute(folderName)
}

function folderToDisplayName(folderName: string): string {
    if (NAME_MAPPINGS[folderName.toLowerCase()]) {
        return NAME_MAPPINGS[folderName.toLowerCase()]
    }
    // Convert kebab-case or lowercase to Title Case
    return folderName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
}

function folderToCode(folderName: string, parentCode: string | null): string {
    const baseName = folderName.toUpperCase().replace(/-/g, '_')
    return parentCode ? `${parentCode}.${baseName}` : baseName
}

function scanDirectory(
    dirPath: string,
    portal: string,
    parentCode: string | null = null,
    basePath: string = ''
): DiscoveredMenu[] {
    const menus: DiscoveredMenu[] = []

    if (!fs.existsSync(dirPath)) {
        return menus
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    let sortOrder = 0

    for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (shouldSkip(entry.name)) continue

        const code = folderToCode(entry.name, parentCode)
        const menuPath = `${basePath}/${entry.name}`

        // Check if folder has page.tsx (it's a navigable route)
        const hasPage = fs.existsSync(path.join(dirPath, entry.name, 'page.tsx'))

        menus.push({
            code,
            name: folderToDisplayName(entry.name),
            parentCode,
            path: hasPage ? menuPath : menuPath, // Still include path for reference
            sortOrder: sortOrder * 10,
            portal,
        })
        sortOrder++

        // Recursively scan subfolders
        const subMenus = scanDirectory(
            path.join(dirPath, entry.name),
            portal,
            code,
            menuPath
        )
        menus.push(...subMenus)
    }

    return menus
}

async function syncMenuDefinitions() {
    console.log('🔍 Auto-discovering menu definitions...\n')

    const appDir = path.join(process.cwd(), 'app')
    const allMenus: DiscoveredMenu[] = []

    // Scan admin portal
    console.log('📁 Scanning /app/admin...')
    const adminMenus = scanDirectory(
        path.join(appDir, 'admin'),
        'admin',
        null,
        '/admin'
    )
    // Add dashboard manually (it's the root)
    adminMenus.unshift({
        code: 'DASHBOARD',
        name: 'Dashboard',
        parentCode: null,
        path: '/admin',
        sortOrder: -10, // First item
        portal: 'admin',
    })
    allMenus.push(...adminMenus)
    console.log(`   Found ${adminMenus.length} menus`)

    // Scan employee portal
    console.log('📁 Scanning /app/employee...')
    const employeeMenus = scanDirectory(
        path.join(appDir, 'employee'),
        'employee',
        null,
        '/employee'
    ).map(m => ({
        ...m,
        code: m.parentCode ? m.code : `EMPLOYEE.${m.code}`,
    }))
    // Add dashboard
    employeeMenus.unshift({
        code: 'EMPLOYEE.DASHBOARD',
        name: 'Dashboard',
        parentCode: null,
        path: '/employee',
        sortOrder: -10,
        portal: 'employee',
    })
    allMenus.push(...employeeMenus)
    console.log(`   Found ${employeeMenus.length} menus`)

    // Scan finance portal
    console.log('📁 Scanning /app/finance...')
    const financeMenus = scanDirectory(
        path.join(appDir, 'finance'),
        'finance',
        null,
        '/finance'
    ).map(m => ({
        ...m,
        code: m.parentCode ? m.code : `FINANCE_PORTAL.${m.code}`,
    }))
    // Add dashboard
    financeMenus.unshift({
        code: 'FINANCE_PORTAL.DASHBOARD',
        name: 'Dashboard',
        parentCode: null,
        path: '/finance',
        sortOrder: -10,
        portal: 'finance',
    })
    allMenus.push(...financeMenus)
    console.log(`   Found ${financeMenus.length} menus`)

    console.log(`\n📊 Total discovered: ${allMenus.length} menus\n`)

    // Sync to database
    console.log('💾 Syncing to database...')
    let created = 0
    let updated = 0

    for (const menu of allMenus) {
        const existing = await prisma.menuDefinition.findUnique({
            where: { code: menu.code }
        })

        if (existing) {
            // Only update if path changed (preserve manual customizations)
            if (existing.path !== menu.path) {
                await prisma.menuDefinition.update({
                    where: { code: menu.code },
                    data: { path: menu.path },
                })
                updated++
            }
        } else {
            // Create new menu
            await prisma.menuDefinition.create({
                data: {
                    code: menu.code,
                    name: menu.name,
                    parentCode: menu.parentCode,
                    path: menu.path,
                    icon: ICON_MAPPINGS[menu.code.toLowerCase()] || null,
                    sortOrder: menu.sortOrder,
                    portal: menu.portal,
                    defaultPerms: { read: true, create: true, update: true, delete: true },
                },
            })
            console.log(`  ✓ NEW: ${menu.code}`)
            created++
        }
    }

    console.log(`\n✅ Sync complete!`)
    console.log(`   Created: ${created} new menus`)
    console.log(`   Updated: ${updated} existing menus`)
    console.log(`   Total in database: ${allMenus.length} menus`)
}

// Main execution
syncMenuDefinitions()
    .catch((e) => {
        console.error('❌ Error syncing menu definitions:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
