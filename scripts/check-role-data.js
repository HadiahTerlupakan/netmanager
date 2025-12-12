const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkRoleData() {
  console.log('🔍 Checking Role Data and Permissions...\n')

  try {
    // 1. Check all CustomRoles
    console.log('📋 Checking Custom Roles:')
    const customRoles = await prisma.customRole.findMany({
      include: {
        _count: {
          select: {
            employeeRoles: true,
          },
        },
      },
    })

    let inactiveRoles = 0
    let rolesWithoutPermissions = 0
    let rolesWithInvalidJSON = 0

    for (const role of customRoles) {
      console.log(`\n  Role: ${role.name} (${role.code})`)
      console.log(`    ID: ${role.id}`)
      console.log(`    Active: ${role.isActive ? '✅' : '❌'}`)
      console.log(`    Priority: ${role.priority}`)
      console.log(`    Employees assigned: ${role._count.employeeRoles}`)

      if (!role.isActive) {
        inactiveRoles++
      }

      // Check allowedFeatures
      if (!role.allowedFeatures) {
        console.log(`    ❌ No allowedFeatures defined`)
        rolesWithoutPermissions++
      } else {
        try {
          const parsed = JSON.parse(role.allowedFeatures)
          if (typeof parsed === 'string' && Array.isArray(parsed.split(','))) {
            // Legacy format: "FEATURE1,FEATURE2"
            const features = parsed.split(',').map(f => f.trim())
            console.log(`    📄 Legacy format with ${features.length} features`)
            console.log(`    Features: ${features.slice(0, 5).join(', ')}${features.length > 5 ? '...' : ''}`)
          } else if (Array.isArray(parsed)) {
            // Array format: ["FEATURE1", "FEATURE2"]
            console.log(`    📄 Array format with ${parsed.length} features`)
            console.log(`    Features: ${parsed.slice(0, 5).join(', ')}${parsed.length > 5 ? '...' : ''}`)
          } else if (typeof parsed === 'object' && parsed !== null) {
            // Matrix format: { FEATURE1: { read: true, create: true, ... }}
            const featureCount = Object.keys(parsed).length
            console.log(`    📄 Matrix format with ${featureCount} features`)
            const features = Object.keys(parsed).slice(0, 5)
            console.log(`    Features: ${features.join(', ')}${featureCount > 5 ? '...' : ''}`)
          } else {
            console.log(`    ⚠️  Unknown format: ${typeof parsed}`)
          }
        } catch (e) {
          console.log(`    ❌ Invalid JSON in allowedFeatures`)
          rolesWithInvalidJSON++
        }
      }
    }

    console.log(`\n📊 Custom Roles Summary:`)
    console.log(`  Total roles: ${customRoles.length}`)
    console.log(`  Inactive roles: ${inactiveRoles} ⚠️`)
    console.log(`  Roles without permissions: ${rolesWithoutPermissions} ⚠️`)
    console.log(`  Roles with invalid JSON: ${rolesWithInvalidJSON} ❌`)

    // 2. Check Users without Employee roles
    console.log('\n👥 Checking User-Employee Role Links:')
    const usersWithoutEmployeeRoles = await prisma.user.findMany({
      where: {
        employee: {
          customRoles: {
            none: {}
          }
        }
      },
      include: {
        employee: true,
      },
      take: 10, // Limit to first 10 for brevity
    })

    console.log(`  Users without custom roles: ${usersWithoutEmployeeRoles.length}`)
    for (const user of usersWithoutEmployeeRoles) {
      console.log(`    - ${user.email} (${user.role})${user.employee ? ` - Employee: ${user.employee.employeeId}` : ' - No Employee linked'}`)
    }

    // 3. Check Employees without Users
    console.log('\n🔗 Checking Employee-User Links:')
    const employeesWithoutUsers = await prisma.employee.findMany({
      where: {
        userId: null,
      },
      take: 10,
    })

    console.log(`  Employees without User links: ${employeesWithoutUsers.length}`)
    for (const emp of employeesWithoutUsers) {
      console.log(`    - ${emp.employeeId} (${emp.fullName})`)
    }

    // 4. Check EmployeeRole records for issues
    console.log('\n🔐 Checking EmployeeRole Records:')
    const employeeRoles = await prisma.employeeRole.findMany({
      include: {
        employee: {
          select: {
            employeeId: true,
            fullName: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        role: {
          select: {
            name: true,
            isActive: true,
          },
        },
      },
      take: 20,
    })

    let employeeRolesWithInactiveRoles = 0
    let employeeRolesWithMissingEmployee = 0
    let employeeRolesWithMissingRole = 0

    for (const er of employeeRoles) {
      if (!er.employee) {
        employeeRolesWithMissingEmployee++
        console.log(`    ❌ EmployeeRole ${er.id} has missing employee`)
      }

      if (!er.role) {
        employeeRolesWithMissingRole++
        console.log(`    ❌ EmployeeRole ${er.id} has missing role`)
      } else if (!er.role.isActive) {
        employeeRolesWithInactiveRoles++
        console.log(`    ⚠️  ${er.employee?.user?.email || er.employee?.employeeId} has inactive role: ${er.role.name}`)
      }
    }

    console.log(`\n📊 EmployeeRole Summary:`)
    console.log(`  Total checked: ${employeeRoles.length}`)
    console.log(`  With inactive roles: ${employeeRolesWithInactiveRoles} ⚠️`)
    console.log(`  Missing employee: ${employeeRolesWithMissingEmployee} ❌`)
    console.log(`  Missing role: ${employeeRolesWithMissingRole} ❌`)

    // 5. Check permission codes against known menu codes
    console.log('\n📝 Checking Permission Codes:')
    const knownMenuCodes = [
      'DASHBOARD', 'USERS', 'ROLES', 'PELANGGAN', 'NETWORK', 'FINANCE',
      'HELPDESK', 'HRIS', 'LAPORAN', 'SETTINGS', 'NETWORK.OLT', 'NETWORK.ONU',
      'NETWORK.IPS', 'NETWORK.VLAN', 'FINANCE.DASHBOARD', 'FINANCE.INVOICES',
      'FINANCE.PAYMENTS', 'FINANCE.REPORTS', 'EMPLOYEE.DASHBOARD',
      'EMPLOYEE.PROFILE', 'EMPLOYEE.NOTIFICATIONS', 'EMPLOYEE.TASKS'
    ]

    const allFeatures = new Set()
    const unknownFeatures = new Set()

    for (const role of customRoles) {
      if (role.allowedFeatures) {
        try {
          const parsed = JSON.parse(role.allowedFeatures)
          let features = []

          if (typeof parsed === 'string') {
            features = parsed.split(',').map(f => f.trim())
          } else if (Array.isArray(parsed)) {
            features = parsed
          } else if (typeof parsed === 'object') {
            features = Object.keys(parsed)
          }

          features.forEach(f => {
            allFeatures.add(f)
            if (!knownMenuCodes.includes(f)) {
              unknownFeatures.add(f)
            }
          })
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }

    console.log(`  Total unique features: ${allFeatures.size}`)
    console.log(`  Unknown features: ${unknownFeatures.size}`)
    if (unknownFeatures.size > 0) {
      console.log(`  Unknown feature codes:`)
      Array.from(unknownFeatures).slice(0, 10).forEach(f => {
        console.log(`    - ${f}`)
      })
      if (unknownFeatures.size > 10) {
        console.log(`    ... and ${unknownFeatures.size - 10} more`)
      }
    }

    // 6. Summary and Recommendations
    console.log('\n🎯 Summary and Recommendations:')
    const issues = []

    if (inactiveRoles > 0) {
      issues.push(`${inactiveRoles} inactive roles that should be activated`)
    }

    if (rolesWithoutPermissions > 0) {
      issues.push(`${rolesWithoutPermissions} roles without permission definitions`)
    }

    if (rolesWithInvalidJSON > 0) {
      issues.push(`${rolesWithInvalidJSON} roles with invalid JSON in permissions`)
    }

    if (employeeRolesWithInactiveRoles > 0) {
      issues.push(`${employeeRolesWithInactiveRoles} employee assignments to inactive roles`)
    }

    if (usersWithoutEmployeeRoles.length > 0) {
      issues.push(`${usersWithoutEmployeeRoles.length} users without custom role assignments`)
    }

    if (issues.length === 0) {
      console.log('  ✅ No critical issues found!')
    } else {
      console.log('  ⚠️  Issues found that may affect permissions:')
      issues.forEach(issue => {
        console.log(`    - ${issue}`)
      })
      console.log('\n  💡 Run `npm run fix-roles` to repair common issues')
    }

  } catch (error) {
    console.error('❌ Error checking role data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  checkRoleData()
}

module.exports = { checkRoleData }