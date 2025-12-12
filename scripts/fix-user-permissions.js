const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixUserPermissions() {
  const email = process.argv[2] || 'ajinomooto@gmail.com'

  console.log(`🔧 Fixing permissions for user: ${email}\n`)

  try {
    // 1. Find user
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      console.log('❌ User not found')
      return
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`)
    console.log(`   Base role: ${user.role}`)

    // 2. Find employee
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      include: {
        department: true,
        customRoles: {
          include: {
            role: true,
          },
        },
      },
    })

    if (!employee) {
      console.log('❌ Employee not found for this user')
      return
    }

    console.log(`✅ Found employee: ${employee.fullName} (${employee.employeeId})`)
    console.log(`   Department: ${employee.department?.name || 'None'}`)
    console.log(`   Custom roles: ${employee.customRoles.length}`)

    // 3. Show custom roles
    for (const er of employee.customRoles) {
      console.log(`   - ${er.role.name} (${er.role.code})`)
      console.log(`     Active: ${er.role.isActive}`)
      console.log(`     Features: ${er.role.allowedFeatures?.substring(0, 100)}...`)
    }

    // 4. Test getEmployeePermissions function
    const { getEmployeePermissions } = require('../lib/utils/permissions.ts')

    console.log('\n🔍 Testing getEmployeePermissions function...')
    const permissions = await getEmployeePermissions(employee.employeeId, user.role)

    if (permissions) {
      console.log(`✅ Permissions returned: ${permissions.allowedFeatures.length} features`)
      console.log('   Features:', permissions.allowedFeatures.join(', '))
    } else {
      console.log('❌ No permissions returned')
    }

    // 5. Check if there are inactive roles
    const inactiveRoles = employee.customRoles.filter(er => !er.role.isActive)
    if (inactiveRoles.length > 0) {
      console.log(`\n⚠️  Found ${inactiveRoles.length} inactive roles:`)
      for (const er of inactiveRoles) {
        console.log(`   - ${er.role.name} (${er.role.code})`)

        // Activate the role
        await prisma.customRole.update({
          where: { id: er.role.id },
          data: { isActive: true }
        })
        console.log(`   ✅ Activated ${er.role.name}`)
      }
    }

    // 6. Check if EmployeeRole is missing
    const hasActiveRole = employee.customRoles.some(er => er.role.isActive)
    if (!hasActiveRole && employee.customRoles.length > 0) {
      console.log('\n⚠️  Employee has roles but none are active')
    }

    if (employee.customRoles.length === 0) {
      console.log('\n⚠️  Employee has no custom roles assigned')

      // Find a default role to assign
      const defaultRole = await prisma.customRole.findFirst({
        where: { isActive: true },
        orderBy: { priority: 'asc' }
      })

      if (defaultRole) {
        console.log(`   Found default role: ${defaultRole.name}`)

        const assignRole = await askQuestion(`Assign role "${defaultRole.name}" to this employee? (y/n): `)
        if (assignRole.toLowerCase() === 'y') {
          await prisma.employeeRole.create({
            data: {
              employeeId: employee.id,
              roleId: defaultRole.id,
              assignedBy: user.id, // Self-assign for debugging
            }
          })
          console.log(`   ✅ Assigned role "${defaultRole.name}"`)
        }
      }
    }

    console.log('\n✅ Permission check completed!')
    console.log('\nNext steps:')
    console.log('1. Log out and log back in')
    console.log('2. Check browser console for permission logs')
    console.log('3. Visit /admin/debug-permissions for detailed info')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

function askQuestion(query) {
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise(resolve => rl.question(query, ans => {
    rl.close()
    resolve(ans)
  }))
}

// Run if called directly
if (require.main === module) {
  fixUserPermissions()
}

module.exports = { fixUserPermissions }