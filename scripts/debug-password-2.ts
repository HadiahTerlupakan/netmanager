
process.env.IS_SEEDING = 'true'
import { prismaAuth } from '../lib/prisma'
import { compare } from 'bcryptjs'

async function main() {
  console.log('--- ADVANCED AUTH DEBUG ---')
  
  const testUsers = [
    { email: 'rohadimraja@gmail.com', password: 'pentagon202#' },
    { email: 'dede@sblnet.id', password: '123456789' },
    { email: 'dede@sbLnet.id', password: '123456789' }
  ]

  for (const test of testUsers) {
    console.log(`\nChecking: "${test.email}"`)
    
    // Test Case-Sensitive Lookup
    const user = await prismaAuth.user.findUnique({
      where: { email: test.email }
    })

    if (!user) {
      console.log(`   ❌ findUnique failed (Case Sensitive)`)
      
      // Try Case-Insensitive Just to confirm existence
      const userInsensitive = await prismaAuth.user.findFirst({
        where: { email: { equals: test.email, mode: 'insensitive' } }
      })
      if (userInsensitive) {
        console.log(`   💡 Found via Case-Insensitive: ${userInsensitive.email}`)
      }
    } else {
      console.log(`   ✅ findUnique success`)
      if (user.passwordHash) {
        const ok = await compare(test.password, user.passwordHash)
        console.log(`   Password Match ("${test.password}"): ${ok ? '✅ YES' : '❌ NO'}`)
        console.log(`   Hash: ${user.passwordHash}`)
      } else {
        console.log(`   ❌ No passwordHash`)
      }
    }
  }
}

main()
