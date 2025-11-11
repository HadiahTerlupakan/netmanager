import { PrismaClient, Role } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

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

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  })

  if (existingUser) {
    console.log(`⚠️  User dengan email ${adminEmail} sudah ada`)
    console.log('🔄 Updating user...')
  } else {
    console.log('➕ Creating new admin user...')
  }

  // Upsert user (create or update)
  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: Role.ADMIN,
      name: 'Administrator',
    },
    create: {
      email: adminEmail,
      name: 'Administrator',
      passwordHash,
      role: Role.ADMIN,
    },
  })

  console.log(`✓ User ${existingUser ? 'updated' : 'created'} successfully`)
  console.log(`   ID: ${user.id}`)
  console.log(`   Email: ${user.email}`)
  console.log(`   Role: ${user.role}`)
  console.log(`   Name: ${user.name}`)

  console.log('\n✅ Seed completed successfully!')
  console.log('\n📝 Login credentials:')
  console.log(`   Email: ${adminEmail}`)
  console.log(`   Password: ${adminPassword}`)
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


