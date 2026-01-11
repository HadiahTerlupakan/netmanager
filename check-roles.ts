import { prisma } from './lib/prisma'

async function checkRoles() {
  const roles = await prisma.role.findMany({
    select: { id: true, name: true }
  })
  console.log('Existing Roles:', roles)
}

checkRoles()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
