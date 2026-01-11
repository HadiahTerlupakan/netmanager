import { prisma } from '../lib/prisma'
import { randomUUID } from 'crypto'
import { PERMISSION_GROUPS, PERMISSION_GROUPS_MOBILE, ACTIONS } from '../lib/permission-config'

// Flatten resources
const ADMIN_RESOURCES = Object.values(PERMISSION_GROUPS).flat()
const MOBILE_RESOURCES = Object.values(PERMISSION_GROUPS_MOBILE).flat()
const ALL_RESOURCES = [...new Set([...ADMIN_RESOURCES, ...MOBILE_RESOURCES])]

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
                    id: randomUUID(),
                    updatedAt: new Date(),
                    name: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource.charAt(0).toUpperCase() + resource.slice(1)}`,
                    resource,
                    action,
                    description: `Allow ${action} on ${resource}`,
                },
            })
            permissions.push(permission)

            if ((MOBILE_RESOURCES as readonly string[]).includes(resource)) {
                karyawanPermissions.push(permission)
            }
        }
    }

    console.log(`   ✅ Synced ${permissions.length} permissions defined in code.`)

    console.log('👥 Updating Super Admin Role permissions...')
    // Only update permissions for Super Admin, do not touch other fields
    await prisma.role.update({
        where: { name: 'Super Admin' },
        data: {
            permission: {
                set: [], // Disconnect all
                connect: permissions.map((p) => ({ id: p.id })), // Reconnect all current
            },
        },
    })
    console.log('   ✅ Role: Super Admin updated with new permissions')

    // Only update permissions for Teknisi if it exists
    const teknisiRole = await prisma.role.findUnique({ where: { name: 'Teknisi' } })
    if (teknisiRole) {
        console.log('👥 Updating Teknisi Role permissions...')
        await prisma.role.update({
            where: { name: 'Teknisi' },
            data: {
                permission: {
                    set: [],
                    connect: karyawanPermissions.map((p) => ({ id: p.id })),
                },
            },
        })
        console.log('   ✅ Role: Teknisi updated with new permissions')
    }

    console.log('\n✅ Permission sync completed! User data was NOT touched.')
}

main()
    .catch((e) => {
        console.error('❌ Sync failed:', e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
