import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const RESOURCES = [
    'dashboard',
    'user',
    'role',
    'finance',
    'network',
    'inventory',
    'ticket',
    'settings',
    'announcement',
    'log'
]

const ACTIONS = ['read', 'create', 'update', 'delete']

async function main() {
    console.log('🌱 Seeding RBAC data...')

    // 1. Create Permissions
    console.log('   Creating permissions...')
    const permissions = []
    for (const resource of RESOURCES) {
        for (const action of ACTIONS) {
            // Skip illogical permissions if necessary (e.g. create dashboard), but for now keep full matrix
            const permission = await prisma.permission.upsert({
                where: {
                    resource_action: {
                        resource,
                        action,
                    },
                },
                update: {},
                create: {
                    name: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource.charAt(0).toUpperCase() + resource.slice(1)}`, // e.g. "Read User"
                    resource,
                    action,
                    description: `Allow ${action} on ${resource}`,
                },
            })
            permissions.push(permission)
        }
    }
    console.log(`   ✅ Synced ${permissions.length} permissions.`)

    // 2. Create SUPER_ADMIN Role
    console.log('   Creating SUPER_ADMIN role...')
    const superAdminRole = await prisma.role.upsert({
        where: { name: 'SUPER_ADMIN' },
        update: {
            permissions: { // Ensure existing role gets all new permissions too
                connect: permissions.map((p) => ({ id: p.id })),
            },
        },
        create: {
            name: 'SUPER_ADMIN',
            description: 'Super Administrator with full access',
            permissions: {
                connect: permissions.map((p) => ({ id: p.id })),
            },
        },
    })
    console.log('   ✅ Role SUPER_ADMIN ready.')

    // 3. Assign SUPER_ADMIN to all existing users
    // We check for users who don't have a role yet
    console.log('   Migrating existing users to SUPER_ADMIN...')
    const updateResult = await prisma.user.updateMany({
        where: {
            roleId: null,
        },
        data: {
            roleId: superAdminRole.id,
        },
    })
    console.log(`   ✅ Updated ${updateResult.count} users to SUPER_ADMIN.`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
