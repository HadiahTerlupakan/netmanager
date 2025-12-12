const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function cleanupBaseRoles() {
  console.log('🧹 Cleaning up base roles...')
  console.log('Setting all users to base role: USER')

  try {
    // Update ALL users to have base role 'USER'
    const result = await prisma.user.updateMany({
      where: {
        role: {
          not: 'USER'
        }
      },
      data: {
        role: 'USER'
      }
    })

    console.log(`✅ Updated ${result.count} users to base role 'USER'`)

    // Verify the update
    const roleCounts = await prisma.user.groupBy({
      by: ['role'],
      _count: true
    })

    console.log('\n📊 Role distribution after cleanup:')
    for (const roleCount of roleCounts) {
      console.log(`   ${roleCount.role}: ${roleCount._count} users`)
    }

  } catch (error) {
    console.error('❌ Error cleaning up base roles:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  cleanupBaseRoles()
}

module.exports = { cleanupBaseRoles }