/**
 * RBAC Cleanup Script
 * Menghapus permissions CRUD yang tidak diperlukan dari resources read-only
 * 
 * Jalankan: npx tsx scripts/cleanup-readonly-permissions.ts
 */

import { prisma } from '../lib/prisma'

// Resources yang seharusnya read-only (tidak perlu create, update, delete)
const READ_ONLY_RESOURCES = [
    'dashboard',
    'work_order_dashboard',
    'system_log',
    'report',
    'daily_income',
    'period_income',
    'profit_loss'
]

// Actions yang harus dihapus dari read-only resources
const CRUD_ACTIONS_TO_REMOVE = ['create', 'update', 'delete']

interface Permission {
    id: string
    resource: string
    action: string
}

async function main() {
    console.log('🔧 RBAC Permission Cleanup')
    console.log('==========================')
    console.log('')
    
    // 1. Cek permissions yang akan dihapus
    const permissionsToDelete = await prisma.permission.findMany({
        where: {
            resource: { in: READ_ONLY_RESOURCES },
            action: { in: CRUD_ACTIONS_TO_REMOVE }
        },
        orderBy: [{ resource: 'asc' }, { action: 'asc' }]
    }) as Permission[]
    
    console.log(`📋 Permissions yang akan dihapus: ${permissionsToDelete.length}`)
    console.log('')
    
    if (permissionsToDelete.length === 0) {
        console.log('✅ Tidak ada permissions yang perlu dihapus.')
        return
    }
    
    // Group by resource for display
    const grouped: Record<string, string[]> = {}
    for (const p of permissionsToDelete) {
        if (!grouped[p.resource]) grouped[p.resource] = []
        grouped[p.resource].push(p.action)
    }
    
    console.log('Resources yang akan dibersihkan:')
    for (const [resource, actions] of Object.entries(grouped)) {
        console.log(`  - ${resource}: ${actions.join(', ')}`)
    }
    console.log('')
    
    // 2. Hapus relasi dari _PermissionToRole terlebih dahulu (junction table)
    const permissionIds = permissionsToDelete.map((p: Permission) => `'${p.id}'`).join(',')
    const deleteResult = await prisma.$executeRawUnsafe(`DELETE FROM "_PermissionToRole" WHERE "B" IN (${permissionIds})`)
    console.log(`🗑️  Hapus ${deleteResult} relasi _PermissionToRole`)
    
    // 3. Hapus permissions
    const permissionResult = await prisma.permission.deleteMany({
        where: {
            id: { in: permissionsToDelete.map((p: Permission) => p.id) }
        }
    })
    console.log(`🗑️  Hapus ${permissionResult.count} permissions`)
    
    console.log('')
    console.log('✅ Cleanup selesai!')
    
    // 4. Verify hasil
    console.log('')
    console.log('📊 Verifikasi hasil:')
    for (const resource of READ_ONLY_RESOURCES) {
        const remaining = await prisma.permission.findMany({
            where: { resource },
            select: { action: true }
        })
        const actions = remaining.map((p: { action: string }) => p.action).sort()
        console.log(`  - ${resource}: ${actions.join(', ')}`)
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())

