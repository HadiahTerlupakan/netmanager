
process.env.IS_SEEDING = 'true'
import { prismaAuth } from '../lib/prisma'
import { compare } from 'bcryptjs'

async function main() {
  const email = 'rohadimraja@gmail.com'
  const password = 'pentagon202#'

  console.log(`--- DEBUGGING AUTH FOR: ${email} ---`)
  
  try {
    const user = await prismaAuth.user.findUnique({
      where: { email },
      include: { role: true }
    })

    if (!user) {
      console.log('❌ User not found in database.')
      return
    }

    console.log('User Found:')
    console.log({
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      role: user.role?.name,
      accessEmployeePanel: user.role?.accessEmployeePanel,
      tenantId: user.tenantId
    })

    if (!user.passwordHash) {
      console.log('❌ User has no passwordHash.')
    } else {
      console.log(`Password Hash: ${user.passwordHash}`)
      
      const isValid = await compare(password, user.passwordHash)
      if (isValid) {
        console.log('✅ Password bcrypt match successful!')
      } else {
        console.log('❌ Password bcrypt match failed.')
      }
    }

    // Also check other user mentioned in logs
    const email2 = 'dede@sbnet.id'
    const user2 = await prismaAuth.user.findUnique({
      where: { email: email2 }
    })
    if (user2) {
      console.log(`\n--- Found User 2: ${email2} ---`)
      console.log({ id: user2.id, email: user2.email, hasHash: !!user2.passwordHash })
    } else {
       console.log(`\n❌ User 2 (${email2}) NOT found.`)
    }

    const email3 = 'dede@sblnet.id'
    const user3 = await prismaAuth.user.findUnique({
      where: { email: email3 }
    })
    if (user3) {
      console.log(`\n--- Found User 3: ${email3} ---`)
      console.log({ id: user3.id, email: user3.email, hasHash: !!user3.passwordHash })
    }

  } catch (e: any) {
    console.error('Error:', e.message)
  }
}

main()
