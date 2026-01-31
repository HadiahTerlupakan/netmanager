
import { prisma } from '../lib/prisma'


async function main() {
  console.log('Fixing permissions...')

  const permissions = [
    {
      name: 'Update Purchase Order',
      resource: 'purchase_orders',
      action: 'update',
      description: 'Allows updating PO status (e.g. Start Shopping)'
    },
    {
      name: 'Receive Purchase Order',
      resource: 'purchase_orders',
      action: 'receive',
      description: 'Allows receiving goods'
    },
    {
        name: 'Delete Purchase Order',
        resource: 'purchase_orders',
        action: 'delete',
        description: 'Allows deleting Draft PO'
    },
    {
        name: 'Create Purchase Order',
        resource: 'purchase_orders',
        action: 'create',
        description: 'Allows creating PO'
    },
     {
        name: 'Read Purchase Order',
        resource: 'purchase_orders',
        action: 'read',
        description: 'Allows viewing PO'
    }
  ]

  const superAdminRole = await prisma.role.findFirst({
    where: { name: 'SUPER_ADMIN' }
  })

  if (!superAdminRole) {
    console.error('SUPER_ADMIN role not found!')
    return
  }

  console.log(`Found SUPER_ADMIN role: ${superAdminRole.id}`)

  for (const perm of permissions) {
    // 1. Upsert Permission
    // We can't easily upsert by (resource, action) unique constraint unless it exists.
    // Let's check findFirst.
    
    let permission = await prisma.permission.findFirst({
        where: {
            resource: perm.resource,
            action: perm.action
        }
    })


    if (!permission) {
        console.log(`Creating permission: ${perm.resource}:${perm.action}`)
        permission = await prisma.permission.create({
            data: {
                ...perm,
                id: crypto.randomUUID(),
                createdAt: new Date(),
                updatedAt: new Date()
            }
        })
    } else {

        console.log(`Permission exists: ${perm.resource}:${perm.action}`)
    }

    // 2. Assign to SUPER_ADMIN
    // Check if connected
    const existingLink = await prisma.role.findFirst({
        where: {
            id: superAdminRole.id,
            permission: {
                some: {
                    id: permission.id
                }
            }
        }
    })

    if (!existingLink) {
        console.log(`Assigning ${perm.resource}:${perm.action} to SUPER_ADMIN`)
        await prisma.role.update({
            where: { id: superAdminRole.id },
            data: {
                permission: {
                    connect: { id: permission.id }
                }
            }
        })
    } else {
         console.log(`SUPER_ADMIN already has ${perm.resource}:${perm.action}`)
    }
  }

  console.log('Permissions fixed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
