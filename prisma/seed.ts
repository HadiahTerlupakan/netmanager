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
      role: 'ADMIN', // Admin user needs ADMIN role for full access
      name: 'Administrator',
    },
    create: {
      email: adminEmail,
      name: 'Administrator',
      passwordHash,
      role: 'ADMIN', // Admin user needs ADMIN role for full access
    },
  })
  console.log(`✓ User created/updated: ${user.email} (Role: ADMIN)`)

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
    },
    create: {
      code: 'ADMINISTRATOR',
      name: 'Administrator',
      description: 'Full access to all features',
      allowedFeatures: allowedFeaturesJson,
      isActive: true,
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
