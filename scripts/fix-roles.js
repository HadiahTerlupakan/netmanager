const { PrismaClient } = require('@prisma/client')
const readline = require('readline')

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function fixRoles() {
  console.log('🔧 Role Data Repair Tool\n')
  console.log('This tool will help fix common permission issues:\n')

  try {
    // 1. Activate inactive roles
    console.log('📋 Checking for inactive roles...')
    const inactiveRoles = await prisma.customRole.findMany({
      where: { isActive: false },
      include: {
        _count: {
          select: {
            employeeRoles: true,
          },
        },
      },
    })

    if (inactiveRoles.length > 0) {
      console.log(`\nFound ${inactiveRoles.length} inactive roles:`)
      inactiveRoles.forEach(role => {
        console.log(`  - ${role.name} (${role.code}) - ${role._count.employeeRoles} employees assigned`)
      })

      const activate = await askQuestion('\nActivate all inactive roles? (y/n): ')
      if (activate.toLowerCase() === 'y') {
        await prisma.customRole.updateMany({
          where: { isActive: false },
          data: { isActive: true },
        })
        console.log(`✅ Activated ${inactiveRoles.length} roles`)
      }
    } else {
      console.log('✅ All roles are already active')
    }

    // 2. Fix roles with empty or null allowedFeatures
    console.log('\n📝 Checking for roles without permissions...')
    const rolesWithoutPermissions = await prisma.customRole.findMany({
      where: {
        OR: [
          { allowedFeatures: null },
          { allowedFeatures: '' },
        ],
      },
    })

    if (rolesWithoutPermissions.length > 0) {
      console.log(`\nFound ${rolesWithoutPermissions.length} roles without permissions:`)
      rolesWithoutPermissions.forEach(role => {
        console.log(`  - ${role.name} (${role.code})`)
      })

      const fixEmpty = await askQuestion('\nAdd default permissions to these roles? (y/n): ')
      if (fixEmpty.toLowerCase() === 'y') {
        const defaultPermissions = JSON.stringify([
          'DASHBOARD', 'EMPLOYEE.DASHBOARD', 'EMPLOYEE.PROFILE', 'EMPLOYEE.NOTIFICATIONS'
        ])

        await prisma.customRole.updateMany({
          where: {
            OR: [
              { allowedFeatures: null },
              { allowedFeatures: '' },
            ],
          },
          data: { allowedFeatures: defaultPermissions },
        })
        console.log(`✅ Added default permissions to ${rolesWithoutPermissions.length} roles`)
      }
    } else {
      console.log('✅ All roles have permission definitions')
    }

    // 3. Fix roles with invalid JSON
    console.log('\n🔍 Checking for roles with invalid JSON in allowedFeatures...')
    const allRoles = await prisma.customRole.findMany({
      where: {
        allowedFeatures: {
          not: null,
        },
      },
    })

    let invalidJsonRoles = []
    for (const role of allRoles) {
      try {
        JSON.parse(role.allowedFeatures)
      } catch (e) {
        invalidJsonRoles.push(role)
      }
    }

    if (invalidJsonRoles.length > 0) {
      console.log(`\nFound ${invalidJsonRoles.length} roles with invalid JSON:`)
      invalidJsonRoles.forEach(role => {
        console.log(`  - ${role.name} (${role.code}): ${role.allowedFeatures?.substring(0, 50)}...`)
      })

      const fixInvalid = await askQuestion('\nFix invalid JSON by converting to array format? (y/n): ')
      if (fixInvalid.toLowerCase() === 'y') {
        for (const role of invalidJsonRoles) {
          // Try to extract features from the invalid string
          let features = []
          if (role.allowedFeatures) {
            // Extract comma-separated values if possible
            features = role.allowedFeatures
              .replace(/[{}[\]]/g, '')
              .replace(/"/g, '')
              .split(',')
              .map(f => f.trim())
              .filter(f => f.length > 0 && f !== 'null' && f !== 'undefined')
              .slice(0, 10) // Limit to first 10 features
          }

          if (features.length === 0) {
            features = ['DASHBOARD'] // Default to just dashboard
          }

          await prisma.customRole.update({
            where: { id: role.id },
            data: { allowedFeatures: JSON.stringify(features) },
          })
          console.log(`  ✅ Fixed ${role.name} - Added ${features.length} features`)
        }
      }
    } else {
      console.log('✅ All roles have valid JSON')
    }

    // 4. Fix legacy permission formats
    console.log('\n🔄 Checking for legacy permission formats...')
    const legacyRoles = []

    for (const role of allRoles) {
      if (role.allowedFeatures) {
        try {
          const parsed = JSON.parse(role.allowedFeatures)
          // Check if it's a legacy string format like "FEATURE1,FEATURE2"
          if (typeof parsed === 'string' && parsed.includes(',')) {
            legacyRoles.push(role)
          }
        } catch (e) {
          // Skip invalid JSON (already handled above)
        }
      }
    }

    if (legacyRoles.length > 0) {
      console.log(`\nFound ${legacyRoles.length} roles with legacy format:`)
      legacyRoles.forEach(role => {
        console.log(`  - ${role.name} (${role.code})`)
      })

      const convertLegacy = await askQuestion('\nConvert legacy formats to modern array format? (y/n): ')
      if (convertLegacy.toLowerCase() === 'y') {
        for (const role of legacyRoles) {
          const parsed = JSON.parse(role.allowedFeatures)
          const features = parsed.split(',').map(f => f.trim()).filter(f => f.length > 0)

          await prisma.customRole.update({
            where: { id: role.id },
            data: { allowedFeatures: JSON.stringify(features) },
          })
          console.log(`  ✅ Converted ${role.name} - ${features.length} features`)
        }
      }
    } else {
      console.log('✅ All roles use modern permission format')
    }

    // 5. Check and fix permission codes
    console.log('\n🔤 Checking permission codes...')
    const knownMenuCodes = new Set([
      'DASHBOARD', 'USERS', 'ROLES', 'PELANGGAN', 'NETWORK', 'FINANCE',
      'HELPDESK', 'HRIS', 'LAPORAN', 'SETTINGS', 'NETWORK.OLT', 'NETWORK.ONU',
      'NETWORK.IPS', 'NETWORK.VLAN', 'FINANCE.DASHBOARD', 'FINANCE.INVOICES',
      'FINANCE.PAYMENTS', 'FINANCE.REPORTS', 'EMPLOYEE.DASHBOARD',
      'EMPLOYEE.PROFILE', 'EMPLOYEE.NOTIFICATIONS', 'EMPLOYEE.TASKS'
    ])

    const rolesWithUnknownCodes = []

    for (const role of allRoles) {
      if (role.allowedFeatures) {
        try {
          const parsed = JSON.parse(role.allowedFeatures)
          let features = []

          if (Array.isArray(parsed)) {
            features = parsed
          } else if (typeof parsed === 'object') {
            features = Object.keys(parsed)
          } else if (typeof parsed === 'string') {
            features = parsed.split(',').map(f => f.trim())
          }

          const unknownCodes = features.filter(f => !knownMenuCodes.has(f))
          if (unknownCodes.length > 0) {
            rolesWithUnknownCodes.push({
              role,
              unknownCodes
            })
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }

    if (rolesWithUnknownCodes.length > 0) {
      console.log(`\nFound ${rolesWithUnknownCodes.length} roles with unknown permission codes:`)
      rolesWithUnknownCodes.forEach(({ role, unknownCodes }) => {
        console.log(`  - ${role.name} (${role.code}): ${unknownCodes.slice(0, 3).join(', ')}${unknownCodes.length > 3 ? '...' : ''}`)
      })

      const fixCodes = await askQuestion('\nRemove unknown permission codes? (y/n): ')
      if (fixCodes.toLowerCase() === 'y') {
        for (const { role } of rolesWithUnknownCodes) {
          try {
            const parsed = JSON.parse(role.allowedFeatures)
            let features = []

            if (Array.isArray(parsed)) {
              features = parsed
            } else if (typeof parsed === 'object') {
              features = Object.keys(parsed)
            } else if (typeof parsed === 'string') {
              features = parsed.split(',').map(f => f.trim())
            }

            const validFeatures = features.filter(f => knownMenuCodes.has(f))

            await prisma.customRole.update({
              where: { id: role.id },
              data: { allowedFeatures: JSON.stringify(validFeatures) },
            })
            console.log(`  ✅ Fixed ${role.name} - kept ${validFeatures.length} valid codes`)
          } catch (e) {
            console.log(`  ❌ Could not fix ${role.name}: ${e.message}`)
          }
        }
      }
    } else {
      console.log('✅ All permission codes are valid')
    }

    // 6. Final summary
    console.log('\n✅ Role repair completed!\n')
    console.log('Recommendations:')
    console.log('1. Test user login with different roles')
    console.log('2. Check browser console for permission debug logs')
    console.log('3. Use /api/debug/user-permissions?email=user@example.com to verify permissions')
    console.log('4. Restart the application server if needed')

  } catch (error) {
    console.error('❌ Error repairing roles:', error)
  } finally {
    rl.close()
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  fixRoles()
}

module.exports = { fixRoles }