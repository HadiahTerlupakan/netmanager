
import { verifyMobileToken, signMobileToken } from '../lib/mobile-auth'
import { prismaAuth } from '../lib/prisma'

async function verify() {
  console.log('--- VERIFYING CIRCULAR DEPENDENCY FIX ---')
  
  // 1. Find a real user to test with
  const user = await prismaAuth.user.findFirst({
     where: { email: 'dede@sblnet.id' }
  })

  if (!user) {
    console.error('❌ Test user not found. Please run seed first.')
    return
  }

  console.log(`Testing with user: ${user.email} (${user.id})`)

  // 2. Sign a token
  const token = await signMobileToken({
    id: user.id,
    email: user.email,
    role: 'ADMIN'
  })
  console.log('✅ Token signed successfully')

  // 3. Verify the token
  // If the circular dependency still exists, this will hang or flood the console
  console.log('Starting verification (should not hang)...')
  const payload = await verifyMobileToken(token)
  
  if (payload) {
    console.log('✅ Token verified successfully without infinite loop!')
    console.log('User ID from payload:', payload.userId)
    console.log('Tenant ID from payload:', payload.tenantId)
  } else {
    console.error('❌ Token verification failed (but at least it didn\'t loop!)')
  }

  console.log('\n--- VERIFYING CASE-INSENSITIVE LOOKUP ---')
  // Note: verifyMobileToken doesn't handle lookup by email, only the LOGIN route does.
  // But we can check if prismaAuth.user responds to case-insensitive queries.
  const userUpper = await prismaAuth.user.findFirst({
    where: { email: { equals: 'DEDE@SBLNET.ID', mode: 'insensitive' } }
  })
  
  if (userUpper && userUpper.id === user.id) {
    console.log('✅ Case-insensitive database lookup works!')
  } else {
    console.error('❌ Case-insensitive database lookup failed!')
  }
}

verify().catch(console.error)
