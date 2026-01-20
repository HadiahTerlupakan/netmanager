import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function seedFinancePermissions() {
  const newResources = ['debts_receivables', 'treasury', 'transactions', 'categories', 'reports']
  const actions = ['read', 'create', 'update', 'delete', 'site_only', 'department_only', 'cancel', 'verify']
  
  // Get roles that have finance:read permission
  const rolesWithFinance = await prisma.$queryRaw<Array<{id: string, name: string}>>`
    SELECT DISTINCT r.id, r.name 
    FROM "roles" r
    JOIN "_PermissionToRole" pr ON r.id = pr."B"
    JOIN "Permission" p ON p.id = pr."A"
    WHERE p.resource = 'finance' AND p.action = 'read'
  `
  
  console.log('Roles with finance permission:', rolesWithFinance.map(r => r.name))
  
  // Create new permissions
  for (const resource of newResources) {
    for (const action of actions) {
      const existing = await prisma.permission.findFirst({
        where: { resource, action }
      })
      
      if (!existing) {
        const perm = await prisma.permission.create({
          data: {
            id: randomUUID(),
            resource,
            action,
            name: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource.charAt(0).toUpperCase() + resource.slice(1).replace(/_/g, ' ')}`,
            description: `Allow ${action} on ${resource}`,
            updatedAt: new Date(),
          }
        })
        console.log('Created:', `${resource}:${action}`)
        
        // Assign to roles that have finance:read
        for (const role of rolesWithFinance) {
          await prisma.$executeRaw`
            INSERT INTO "_PermissionToRole" ("A", "B") 
            VALUES (${perm.id}, ${role.id})
            ON CONFLICT DO NOTHING
          `
        }
      } else {
        console.log('Exists:', `${resource}:${action}`)
        // Still assign to roles that might not have it
        for (const role of rolesWithFinance) {
          await prisma.$executeRaw`
            INSERT INTO "_PermissionToRole" ("A", "B") 
            VALUES (${existing.id}, ${role.id})
            ON CONFLICT DO NOTHING
          `
        }
      }
    }
  }
  
  console.log('\nDone seeding finance permissions!')
}

seedFinancePermissions()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
