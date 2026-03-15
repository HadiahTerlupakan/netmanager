
import { prismaAuth } from '../lib/prisma'
import { prismaMitraAuth } from '../lib/prisma-mitra'

async function verify() {
  console.log('--- VERIFYING AUTH LOOKUP (No Tenant Context) ---')
  
  // Test Employee Lookup
  const testEmail = 'admin@example.com'
  console.log(`Checking Employee: ${testEmail}...`)
  try {
    const user = await prismaAuth.user.findUnique({
      where: { email: testEmail }
    })
    if (user) {
      console.log('✅ Success: Employee found globally!')
      console.log({ id: user.id, email: user.email, tenantId: user.tenantId })
    } else {
      console.log('❌ Failed: Employee not found globally.')
    }
  } catch (e: any) {
    console.error('Error:', e.message)
  }

  // Test Mitra Lookup (if any)
  console.log('\nChecking Mitra...')
  try {
    const mitra = await prismaMitraAuth.mitra.findFirst()
    if (mitra) {
      console.log('✅ Success: Mitra found globally!')
      console.log({ id: mitra.id, email: mitra.email, tenantId: mitra.tenantId })
    } else {
      console.log('ℹ️ Info: No mitras in DB to test, but lookup mechanism is active.')
    }
  } catch (e: any) {
    console.error('Error:', e.message)
  }

  // Double Check with Isolated Client (should fail without context)
  console.log('\n--- VERIFYING ISOLATION STILL WORKS ---')
  const { prisma } = await import('../lib/prisma')
  try {
    const isolatedUser = await prisma.user.findUnique({
      where: { email: testEmail }
    })
    if (!isolatedUser) {
      console.log('✅ Success: Isolated client correctly blocked lookup without context.')
    } else {
      console.log('⚠️ Warning: Isolated client found user! (Maybe running as Super Admin or context exists?)')
    }
  } catch (e: any) {
     console.log('✅ Success: Isolated client blocked/errored as expected.')
  }
}

verify().catch(console.error)
