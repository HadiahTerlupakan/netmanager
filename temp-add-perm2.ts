import prisma from './lib/prisma'

const prisma = new PrismaClient()

async function main() {
  const adminRole = await prisma.role.findUnique({
    where: { name: 'SUPER_ADMIN' }
  })
  
  if (adminRole) {
    console.log('Found SUPER_ADMIN role', adminRole.id)
    const actions = ['read', 'create', 'update', 'delete']
    for (const action of actions) {
      const p = await prisma.permission.upsert({
        where: {
          resource_action: {
            resource: 'acs',
            action: action
          }
        },
        update: {},
        create: {
          id: `perm_acs_${action}`,
          name: `acs:${action}`,
          resource: 'acs',
          action: action,
          description: `Can ${action} acs`
        }
      })
      
      // Connect to role
      await prisma.role.update({
        where: { id: adminRole.id },
        data: {
          permission: {
            connect: { id: p.id }
          }
        }
      })
      console.log(`Added acs:${action} to SUPER_ADMIN`)
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
