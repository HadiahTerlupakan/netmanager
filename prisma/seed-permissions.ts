
import { PrismaClient } from '@prisma/client'
import { PERMISSION_GROUPS, PERMISSION_GROUPS_KARYAWAN, ACTIONS } from '../lib/permission-config'

const prisma = new PrismaClient()

// Flatten resources
const ADMIN_RESOURCES = Object.values(PERMISSION_GROUPS).flat()
const KARYAWAN_RESOURCES = Object.values(PERMISSION_GROUPS_KARYAWAN).flat()
const ALL_RESOURCES = [...new Set([...ADMIN_RESOURCES, ...KARYAWAN_RESOURCES])]

async function main() {
    console.log('🔒 Seeding Permissions ONLY...\n')

    // --- RBAC Setup ---
    console.log('📋 Updating permissions matrix...')
    const permissions = []
    const karyawanPermissions = []

    // Upsert Permissions
    for (const resource of ALL_RESOURCES) {
        for (const action of ACTIONS) {
            const permission = await prisma.permission.upsert({
                where: {
                    resource_action: {
                        resource,
                        action,
                    },
                },
                update: {}, // No change if exists
                create: {
                    name: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource.charAt(0).toUpperCase() + resource.slice(1)}`,
                    resource,
                    action,
                    description: `Allow ${action} on ${resource}`,
                },
            })
            permissions.push(permission)

            if ((KARYAWAN_RESOURCES as readonly string[]).includes(resource)) {
                karyawanPermissions.push(permission)
            }
        }
    }

    console.log(`   ✅ Synced ${permissions.length} permissions defined in code.`)

    console.log('👥 Updating SUPER_ADMIN Role permissions...')
    // Only update permissions for SUPER_ADMIN, do not touch other fields
    await prisma.role.update({
        where: { name: 'SUPER_ADMIN' },
        data: {
            permissions: {
                set: [], // Disconnect all
                connect: permissions.map((p) => ({ id: p.id })), // Reconnect all current
            },
        },
    })
    console.log('   ✅ Role: SUPER_ADMIN updated with new permissions')

    // Only update permissions for teknisi if it exists
    const teknisiRole = await prisma.role.findUnique({ where: { name: 'teknisi' } })
    if (teknisiRole) {
        console.log('👥 Updating teknisi Role permissions...')
        await prisma.role.update({
            where: { name: 'teknisi' },
            data: {
                permissions: {
                    set: [],
                    connect: karyawanPermissions.map((p) => ({ id: p.id })),
                },
            },
        })
        console.log('   ✅ Role: teknisi updated with new permissions')
    }

    console.log('\n✅ Permission sync completed! User data was NOT touched.')
}

main()
    .catch((e) => {
        console.error('❌ Sync failed:', e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
