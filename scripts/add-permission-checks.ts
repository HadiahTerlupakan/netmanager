/**
 * Script untuk menambahkan ensurePermission ke semua halaman yang belum punya
 * Jalankan dengan: npx tsx scripts/add-permission-checks.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// Mapping path ke permission resource
const PATH_TO_PERMISSION: Record<string, string> = {
    // Dashboard
    '/admin/page.tsx': 'dashboard',

    // Attendance
    '/admin/attendance/page.tsx': 'attendance',

    // Settings/Roles
    '/admin/settings/roles/page.tsx': 'roles',
    '/admin/settings/roles/[id]/page.tsx': 'roles',
    '/admin/settings/roles/new/page.tsx': 'roles',

    // Pengaturan
    '/admin/pengaturan/page.tsx': 'pengaturan',
    '/admin/pengaturan/umum/page.tsx': 'umum',
    '/admin/pengaturan/logo/page.tsx': 'logo',
    '/admin/pengaturan/email/page.tsx': 'email',
    '/admin/pengaturan/whatsapp/page.tsx': 'whatsapp',
    '/admin/pengaturan/api/page.tsx': 'api',
    '/admin/pengaturan/payment-gateway/page.tsx': 'payment_gateway',
    '/admin/pengaturan/captcha/page.tsx': 'pengaturan',
    '/admin/pengaturan/company-bank-accounts/page.tsx': 'pengaturan',

    // Network
    '/admin/network/onu/new/page.tsx': 'onu',
    '/admin/network/onu/register/page.tsx': 'onu',
    '/admin/network/onutype/new/page.tsx': 'onutype',
    '/admin/network/mikrotik/new/page.tsx': 'mikrotik',
    '/admin/network/mikrotik/[id]/edit/page.tsx': 'mikrotik',

    // FTTH - OTB
    '/admin/ftth/otb/new/page.tsx': 'otb',
    '/admin/ftth/otb/[id]/page.tsx': 'otb',
    '/admin/ftth/otb/[id]/edit/page.tsx': 'otb',

    // FTTH - ODC
    '/admin/ftth/odc/new/page.tsx': 'odc',
    '/admin/ftth/odc/[id]/page.tsx': 'odc',
    '/admin/ftth/odc/[id]/edit/page.tsx': 'odc',

    // FTTH - ODP
    '/admin/ftth/odp/new/page.tsx': 'odp',
    '/admin/ftth/odp/[id]/page.tsx': 'odp',
    '/admin/ftth/odp/[id]/edit/page.tsx': 'odp',

    // FTTH - Closure
    '/admin/ftth/closure/new/page.tsx': 'closure',
    '/admin/ftth/closure/[id]/page.tsx': 'closure',
    '/admin/ftth/closure/[id]/edit/page.tsx': 'closure',

    // FTTH - Pole
    '/admin/ftth/pole/new/page.tsx': 'pole',
    '/admin/ftth/pole/[id]/page.tsx': 'pole',
    '/admin/ftth/pole/[id]/edit/page.tsx': 'pole',

    // FTTH - KMZ
    '/admin/ftth/kmz/new/page.tsx': 'kmz',

    // Inventory
    '/admin/inventory/page.tsx': 'inventory',
    '/admin/inventory/barang/new/page.tsx': 'barang',
    '/admin/inventory/barang/[id]/page.tsx': 'barang',
    '/admin/inventory/barang/[id]/edit/page.tsx': 'barang',
    '/admin/inventory/gudang/new/page.tsx': 'gudang',
    '/admin/inventory/gudang/[id]/edit/page.tsx': 'gudang',

    // Users
    '/admin/users/new/page.tsx': 'users',
    '/admin/users/[id]/page.tsx': 'users',

    // Support
    '/admin/support/[id]/page.tsx': 'support',

    // Kehadiran
    '/admin/kehadiran/laporan/page.tsx': 'report',

    // Lembur
    '/admin/lembur/page.tsx': 'lembur',

    // Log
    '/admin/log/activity/page.tsx': 'activity',
    '/admin/log/login/page.tsx': 'login',

    // Finance
    '/admin/finance/pengeluaran/page.tsx': 'expense',
    '/admin/finance/laba-rugi/page.tsx': 'profit_loss',
    '/admin/finance/pendapatan-periode/page.tsx': 'period_income',

    // Work Orders
    '/admin/workorders/departments/new/page.tsx': 'department',
    '/admin/workorders/departments/[id]/edit/page.tsx': 'department',
    '/admin/workorders/page.tsx': 'work_order_dashboard',
    '/admin/workorders/[id]/page.tsx': 'list',
}

function getPermissionFromPath(filePath: string): string | null {
    // Normalize path
    const normalizedPath = filePath.replace(/\\/g, '/')

    // Try exact match first
    for (const [pattern, permission] of Object.entries(PATH_TO_PERMISSION)) {
        if (normalizedPath.endsWith(pattern)) {
            return permission
        }
    }

    // Try pattern matching for dynamic routes
    const segments = normalizedPath.split('/')
    const adminIndex = segments.indexOf('admin')
    if (adminIndex === -1) return null

    const relevantPath = segments.slice(adminIndex + 1)

    // Get the main section
    const section = relevantPath[0]

    // Map section to permission
    const sectionMap: Record<string, string> = {
        'network': 'network',
        'ftth': 'ftth',
        'paket': 'paket',
        'pelanggan': 'pelanggan',
        'inventory': 'inventory',
        'workorders': 'workorders',
        'kehadiran': 'kehadiran',
        'finance': 'finance',
        'pengaturan': 'pengaturan',
        'log': 'system_log',
        'users': 'users',
        'support': 'support',
        'announcement': 'announcement',
        'attendance': 'attendance',
        'lembur': 'lembur',
    }

    return sectionMap[section] || null
}

function isClientComponent(content: string): boolean {
    return content.includes("'use client'") || content.includes('"use client"')
}

function addPermissionCheck(filePath: string, permission: string): void {
    const content = fs.readFileSync(filePath, 'utf-8')

    // Skip if already has ensurePermission
    if (content.includes('ensurePermission')) {
        console.log(`  ⏭️  Already has permission check: ${filePath}`)
        return
    }

    // For client components, we can't use server-side ensurePermission directly
    // We need to convert to server component pattern or use a different approach
    if (isClientComponent(content)) {
        console.log(`  ⚠️  Client component, needs manual review: ${filePath}`)
        return
    }

    // For server components, add ensurePermission
    const importStatement = `import { ensurePermission } from '@/lib/rbac'\n`
    const permissionCheck = `    await ensurePermission('${permission}:read')\n`

    // Find the function and add permission check after it
    let newContent = content

    // Add import if not exists
    if (!content.includes("import { ensurePermission }")) {
        newContent = importStatement + newContent
    }

    // Find the async function and add permission check
    const functionMatch = newContent.match(/export default async function \w+\([^)]*\)\s*{/)
    if (functionMatch) {
        const insertPos = newContent.indexOf(functionMatch[0]) + functionMatch[0].length
        newContent = newContent.slice(0, insertPos) + '\n' + permissionCheck + newContent.slice(insertPos)

        fs.writeFileSync(filePath, newContent)
        console.log(`  ✅ Added permission check (${permission}:read): ${filePath}`)
    } else {
        console.log(`  ⚠️  Could not find async function: ${filePath}`)
    }
}

async function main() {
    const adminDir = path.join(process.cwd(), 'app/admin')

    console.log('🔍 Scanning for pages without permission checks...\n')

    function scanDir(dir: string) {
        const files = fs.readdirSync(dir)

        for (const file of files) {
            const filePath = path.join(dir, file)
            const stat = fs.statSync(filePath)

            if (stat.isDirectory()) {
                scanDir(filePath)
            } else if (file === 'page.tsx') {
                const content = fs.readFileSync(filePath, 'utf-8')

                if (!content.includes('ensurePermission')) {
                    const permission = getPermissionFromPath(filePath)

                    if (permission) {
                        addPermissionCheck(filePath, permission)
                    } else {
                        console.log(`  ❓ Unknown permission for: ${filePath}`)
                    }
                }
            }
        }
    }

    scanDir(adminDir)

    console.log('\n✅ Done!')
}

main().catch(console.error)
