
import { prisma } from '../lib/prisma'

function generateId(): string {
    return `perm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

async function main() {
    console.log('Adding NADA_DERING permissions...')

    const perm = {
        name: 'nada_dering:read',
        description: 'Membaca pengaturan nada dering',
        resource: 'nada_dering', 
        action: 'read'
    }

    try {
        // Upsert permission
        // Using compound unique key pattern from existing codebase
        const permission = await prisma.permission.upsert({
            where: {
                resource_action: {
                    resource: perm.resource,
                    action: perm.action
                }
            },
            update: {},
            create: {
                id: generateId(),
                name: perm.name,
                description: perm.description,
                resource: perm.resource,
                action: perm.action,
                updatedAt: new Date()
            }
        })
        console.log(`Permission ensured: ${permission.id}`)

        // Assign to Super Admin
        const superAdminRole = await prisma.role.findFirst({
            where: { name: 'SUPER_ADMIN' }
        })

        if (superAdminRole) {
            console.log(`Assigning to Role: ${superAdminRole.name} (ID: ${superAdminRole.id})`)
            
            // Try connecting
            await prisma.role.update({
                where: { id: superAdminRole.id },
                data: {
                    permission: {
                        connect: { id: permission.id }
                    }
                }
            })
            console.log(`Assigned permission to SUPER_ADMIN`)
        }
    } catch (e: any) {
        console.error('Error in script:', e)
        // Check if error is due to field name mismatch (permissions vs permission)
        if (e.message?.includes('Unknown arg')) {
            console.log('Retrying with different relation field name...')
            const superAdminRole = await prisma.role.findFirst({ where: { name: 'SUPER_ADMIN' } })
            if (superAdminRole) {
                 await prisma.role.update({
                    where: { id: superAdminRole.id },
                    data: {
                        permission: { // Try singular as fallback
                            connect: { id: (await prisma.permission.findFirst({where: {resource: 'nada_dering', action: 'read'}}))?.id }
                        }
                    }
                })
                console.log(`Assigned permission to SUPER_ADMIN (fallback)`)
            }
        }
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
