const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function updateUserRole(email, newRole) {
  console.log(`📝 Updating user role...`)
  console.log(`Email: ${email}`)
  console.log(`New Role: ${newRole}\n`)

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      console.log('❌ User not found')
      return
    }

    console.log(`✅ Found user: ${user.name} (${user.email})`)
    console.log(`   Current role: ${user.role}`)

    // Update role
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: newRole }
    })

    console.log(`✅ Role updated successfully!`)
    console.log(`   New role: ${updatedUser.role}`)
    console.log(`   Updated at: ${updatedUser.updatedAt}`)

    // Verify update
    const verifyUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true }
    })

    console.log(`\n✅ Verification successful:`)
    console.log(`   ID: ${verifyUser.id}`)
    console.log(`   Email: ${verifyUser.email}`)
    console.log(`   Role: ${verifyUser.role}`)

  } catch (error) {
    console.error('❌ Error updating user role:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  const email = process.argv[2] || 'ajinomooto@gmail.com'
  const role = process.argv[3] || 'ADMIN'

  updateUserRole(email, role)
}

module.exports = { updateUserRole }