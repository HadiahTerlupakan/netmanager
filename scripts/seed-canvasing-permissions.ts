
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL not found')

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding Canvasing permissions...')

  const permissions = [
    { resource: 'marketing', action: 'read', description: 'View Marketing menu' },
    { resource: 'marketing', action: 'create', description: 'Create Marketing data' },
    { resource: 'marketing', action: 'update', description: 'Update Marketing data' },
    { resource: 'marketing', action: 'delete', description: 'Delete Marketing data' },
    { resource: 'marketing', action: 'site_only', description: 'Marketing site restriction' },
    
    { resource: 'canvasing', action: 'read', description: 'View Canvasing requests' },
    { resource: 'canvasing', action: 'create', description: 'Create Canvasing request' },
    { resource: 'canvasing', action: 'update', description: 'Update/Approve Canvasing request' },
    { resource: 'canvasing', action: 'delete', description: 'Delete Canvasing request' },
    { resource: 'canvasing', action: 'site_only', description: 'Canvasing site restriction' },

    { resource: 'sales', action: 'read', description: 'View Sales Coverage data' },
    { resource: 'sales', action: 'create', description: 'Create Sales Coverage entry' },
    { resource: 'sales', action: 'update', description: 'Update Sales Coverage data' },
    { resource: 'sales', action: 'delete', description: 'Delete Sales Coverage data' },
    { resource: 'sales', action: 'site_only', description: 'Sales site restriction' },

    { resource: 'coupon', action: 'read', description: 'View Coupons' },
    { resource: 'coupon', action: 'create', description: 'Create Coupons' },
    { resource: 'coupon', action: 'update', description: 'Update Coupons' },
    { resource: 'coupon', action: 'delete', description: 'Delete Coupons' },
    { resource: 'coupon', action: 'site_only', description: 'Coupon site restriction' },

    // Mobile App Permissions
    { resource: 'm_canvasing', action: 'read', description: 'Access Mobile Canvasing Menu' },
    { resource: 'm_canvasing', action: 'create', description: 'Create data via Mobile Canvasing' },
  ]

  // 1. Create permissions if not exist
  for (const perm of permissions) {
    const exists = await prisma.permission.findFirst({
        where: {
            resource: perm.resource,
            action: perm.action
        }
    })

    if (!exists) {
        await prisma.permission.create({
            data: {
                id: crypto.randomUUID(),
                name: `${perm.resource}:${perm.action}`,
                ...perm,
                updatedAt: new Date()
            }
        })
        console.log(`Created permission: ${perm.resource}:${perm.action}`)
    }
  }

  // 2. Assign to relevant roles
  const targetRoles = await prisma.role.findMany({
    where: { 
        name: { 
            in: ['Super Admin', 'SUPER_ADMIN', ' Branch Manager', 'Branch Manager', 'SALES', 'Sales', 'ADMIN', 'Admin'] 
        } 
    }
  })

  console.log(`Found ${targetRoles.length} target roles: ${targetRoles.map(r => r.name).join(', ')}`)

  const allPerms = await prisma.permission.findMany({
      where: {
          resource: { in: ['marketing', 'canvasing', 'coupon', 'sales', 'm_canvasing'] }
      }
  })

  for (const role of targetRoles) {
    // Connect all new permissions to the role
    await prisma.role.update({
        where: { id: role.id },
        data: {
            permission: {
                connect: allPerms.map(p => ({ id: p.id }))
            }
        }
    })
    console.log(`Assigned ${allPerms.length} permissions to role: ${role.name}`)
  }

  console.log('Done!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
