
process.env.IS_SEEDING = 'true'
import { prisma } from '../lib/prisma'
import { prismaMitra } from '../lib/prisma-mitra'

async function main() {
  console.log('--- DIAGNOSTIC: USER TABLE (Isolation Bypassed) ---')
  try {
    const users = await prisma.user.findMany({
      include: { 
        role: true
      }
    })
    
    if (users.length === 0) {
      console.log('No users found in database!')
    } else {
      users.forEach(u => {
        console.log({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role?.name,
          accessEmployeePanel: u.role?.accessEmployeePanel,
          isSuperAdmin: u.role?.isSuperAdmin,
          hasPasswordHash: !!u.passwordHash,
          tenantId: u.tenantId
        })
      })
    }
  } catch (e: any) {
    console.error('Error fetching users:', e.message)
  }

  console.log('\n--- DIAGNOSTIC: MITRA TABLE (Isolation Bypassed) ---')
  try {
    const mitras = await prismaMitra.mitra.findMany()
    if (mitras.length === 0) {
      console.log('No mitras found.')
    } else {
      mitras.forEach(m => {
        console.log({
          id: m.id,
          email: m.email,
          name: m.name,
          isActive: m.isActive,
          hasPasswordHash: !!m.passwordHash,
          tenantId: m.tenantId
        })
      })
    }
  } catch (e: any) {
    console.error('Error fetching mitras:', e.message)
  }

  console.log('\n--- DIAGNOSTIC: PELANGGAN (CUSTOMER) TABLE (Isolation Bypassed) ---')
  try {
    const customers = await prisma.pelanggan.findMany({
      take: 5
    })
    if (customers.length === 0) {
      console.log('No customers found.')
    } else {
      customers.forEach(c => {
        console.log({
          id: c.id,
          username: c.username,
          hasPasswordHash: !!c.passwordHash,
          tenantId: c.tenantId
        })
      })
    }
  } catch (e: any) {
    console.error('Error fetching customers:', e.message)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    // cleanup
  })
