import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

// All available features/permissions
const ALL_FEATURES = [
  'DASHBOARD',
  'ROLES',
  'NETWORK',
  'FTTH',
  'PAKET',
  'PELANGGAN',
  'INVENTORY',
  'USERS',
  'HELPDESK',
  'WORKORDERS',
  'HRIS',
  'FINANCE',
  'PENGATURAN'
]

async function main() {
  console.log('🌱 Starting database seed...\n')

  // Check database connection
  try {
    await prisma.$connect()
    console.log('✓ Database connection OK')
  } catch (error: any) {
    console.error('✗ Database connection failed:', error.message)
    throw error
  }

  // Get admin credentials from environment or use defaults
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123'

  // Validate email format
  if (!adminEmail.includes('@')) {
    throw new Error(`Invalid email format: ${adminEmail}`)
  }

  // Validate password length
  if (adminPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long')
  }

  console.log(`📧 Admin email: ${adminEmail}`)
  console.log('🔐 Hashing password...')

  const passwordHash = await hash(adminPassword, 10)

  // ============================================
  // STEP 1: Create/Update Admin User
  // ============================================
  console.log('\n📦 Step 1: Creating admin user...')

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      name: 'Administrator',
    },
    create: {
      email: adminEmail,
      name: 'Administrator',
      passwordHash,
    },
  })
  console.log(`✓ User created/updated: ${user.email}`)

  // ============================================
  // STEP 2: Create Administrator CustomRole
  // ============================================
  console.log('\n📦 Step 2: Creating Administrator role...')

  // allowedFeatures is stored as JSON string in database
  const allowedFeaturesJson = JSON.stringify(ALL_FEATURES)

  const adminRole = await prisma.customRole.upsert({
    where: { code: 'ADMINISTRATOR' },
    update: {
      name: 'Administrator',
      description: 'Full access to all features',
      allowedFeatures: allowedFeaturesJson,
      isActive: true,
      departmentId: null, // Global role, not department-specific
    },
    create: {
      code: 'ADMINISTRATOR',
      name: 'Administrator',
      description: 'Full access to all features',
      allowedFeatures: allowedFeaturesJson,
      isActive: true,
      departmentId: null, // Global role, not department-specific
    },
  })
  console.log(`✓ CustomRole created/updated: ${adminRole.name}`)
  console.log(`  Permissions: ${ALL_FEATURES.length} features`)

  // ============================================
  // STEP 3: Create Employee for Admin User
  // ============================================
  console.log('\n📦 Step 3: Creating employee profile...')

  // Check if employee already exists for this user
  let employee = await prisma.employee.findFirst({
    where: { userId: user.id }
  })

  if (!employee) {
    // Use upsert to handle potential duplicate employeeId
    employee = await prisma.employee.upsert({
      where: { employeeId: 'EMP-ADMIN' },
      update: {
        fullName: 'Administrator',
        email: adminEmail,
        userId: user.id,
        employmentStatus: 'PERMANENT',
        joinDate: new Date(),
        createdBy: user.id,
      },
      create: {
        employeeId: 'EMP-ADMIN',
        fullName: 'Administrator',
        email: adminEmail,
        userId: user.id,
        employmentStatus: 'PERMANENT',
        joinDate: new Date(),
        createdBy: user.id,
      },
    })
    console.log(`✓ Employee created/updated: ${employee.employeeId}`)
  } else {
    console.log(`⚠️  Employee already exists: ${employee.employeeId}`)
  }

  // ============================================
  // STEP 4: Assign Administrator Role to Employee
  // ============================================
  console.log('\n📦 Step 4: Assigning role to employee...')

  // Remove existing roles and create new one
  await prisma.employeeRole.deleteMany({
    where: { employeeId: employee.id },
  })

  const employeeRole = await prisma.employeeRole.create({
    data: {
      employeeId: employee.id,
      roleId: adminRole.id,
      assignedBy: user.id,
    },
  })
  console.log(`✓ Role assigned: ${adminRole.name} → ${employee.fullName}`)

  // ============================================
  // STEP 5: Seed Menu Definitions
  // ============================================
  console.log('\n📦 Step 5: Creating menu definitions...')

  const menuDefinitions = [
    // Admin Portal Top-Level Menus
    { code: 'DASHBOARD', name: 'Dashboard', path: '/admin', icon: 'HomeIcon', sortOrder: 1, portal: 'admin' },
    { code: 'PELANGGAN', name: 'Pelanggan', path: '/admin/pelanggan', icon: 'UsersIcon', sortOrder: 2, portal: 'admin' },
    { code: 'NETWORK', name: 'Network', path: null, icon: 'ServerIcon', sortOrder: 3, portal: 'admin' },
    { code: 'FTTH', name: 'FTTH', path: null, icon: 'SignalIcon', sortOrder: 4, portal: 'admin' },
    { code: 'PAKET', name: 'Paket Internet', path: '/admin/paket', icon: 'CubeIcon', sortOrder: 5, portal: 'admin' },
    { code: 'INVENTORY', name: 'Inventory', path: '/admin/inventory', icon: 'ArchiveBoxIcon', sortOrder: 6, portal: 'admin' },
    { code: 'HELPDESK', name: 'Helpdesk', path: '/admin/helpdesk', icon: 'TicketIcon', sortOrder: 7, portal: 'admin' },
    { code: 'WORKORDERS', name: 'Work Orders', path: '/admin/workorders', icon: 'WrenchIcon', sortOrder: 8, portal: 'admin' },
    { code: 'HRIS', name: 'HRIS', path: null, icon: 'UserGroupIcon', sortOrder: 9, portal: 'admin' },
    { code: 'FINANCE', name: 'Keuangan', path: null, icon: 'BanknotesIcon', sortOrder: 10, portal: 'admin' },
    { code: 'USERS', name: 'Pengguna', path: '/admin/users', icon: 'UserCircleIcon', sortOrder: 11, portal: 'admin' },
    { code: 'ROLES', name: 'Manajemen Role', path: '/admin/roles', icon: 'ShieldCheckIcon', sortOrder: 12, portal: 'admin' },
    { code: 'PENGATURAN', name: 'Pengaturan', path: '/admin/pengaturan', icon: 'Cog6ToothIcon', sortOrder: 13, portal: 'admin' },

    // Employee Portal Menus
    { code: 'EMPLOYEE.DASHBOARD', name: 'Dashboard', path: '/employee', icon: 'HomeIcon', sortOrder: 1, portal: 'employee' },
    { code: 'EMPLOYEE.ABSENSI', name: 'Absensi', path: '/employee/attendance', icon: 'ClockIcon', sortOrder: 2, portal: 'employee' },
    { code: 'EMPLOYEE.CUTI', name: 'Cuti', path: '/employee/leaves', icon: 'CalendarIcon', sortOrder: 3, portal: 'employee' },
    { code: 'EMPLOYEE.INVENTORY', name: 'Inventory', path: '/employee/inventory', icon: 'ArchiveBoxIcon', sortOrder: 4, portal: 'employee' },
    { code: 'EMPLOYEE.WORKORDERS', name: 'Work Orders', path: '/employee/workorders', icon: 'WrenchIcon', sortOrder: 5, portal: 'employee' },
    { code: 'EMPLOYEE.PAYSLIPS', name: 'Slip Gaji', path: '/employee/payslips', icon: 'DocumentTextIcon', sortOrder: 6, portal: 'employee' },
    { code: 'EMPLOYEE.PROFILE', name: 'Profil', path: '/employee/profile', icon: 'UserIcon', sortOrder: 7, portal: 'employee' },

    // Finance Portal Menus  
    { code: 'FINANCE.DASHBOARD', name: 'Dashboard', path: '/finance', icon: 'HomeIcon', sortOrder: 1, portal: 'finance' },
    { code: 'FINANCE.TAGIHAN', name: 'Tagihan', path: '/finance/tagihan', icon: 'DocumentTextIcon', sortOrder: 2, portal: 'finance' },
    { code: 'FINANCE.PENGELUARAN', name: 'Pengeluaran', path: '/finance/pengeluaran', icon: 'ArrowDownTrayIcon', sortOrder: 3, portal: 'finance' },
    { code: 'FINANCE.TAX', name: 'Pajak', path: '/finance/tax', icon: 'ReceiptPercentIcon', sortOrder: 4, portal: 'finance' },
    { code: 'FINANCE.CASHFLOW', name: 'Cashflow', path: '/finance/cashflow', icon: 'ArrowsRightLeftIcon', sortOrder: 5, portal: 'finance' },
  ]

  for (const menu of menuDefinitions) {
    await prisma.menuDefinition.upsert({
      where: { code: menu.code },
      update: {
        name: menu.name,
        path: menu.path,
        icon: menu.icon,
        sortOrder: menu.sortOrder,
        portal: menu.portal,
      },
      create: menu,
    })
  }
  console.log(`✓ Created ${menuDefinitions.length} menu definitions`)

  // ============================================
  // Summary
  // ============================================
  console.log('\n' + '='.repeat(50))
  console.log('✅ Seed completed successfully!')
  console.log('='.repeat(50))
  console.log('\n📝 Login credentials:')
  console.log(`   Email: ${adminEmail}`)
  console.log(`   Password: ${adminPassword}`)
  console.log('\n📋 Admin has access to:')
  ALL_FEATURES.forEach(f => console.log(`   ✓ ${f}`))
  console.log('\n💡 Tip: Set SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD di .env untuk custom credentials')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('\n❌ Seed failed!')
    console.error('Error:', e.message)
    if (e.stack) {
      console.error('\nStack trace:')
      console.error(e.stack)
    }
    await prisma.$disconnect()
    process.exit(1)
  })
