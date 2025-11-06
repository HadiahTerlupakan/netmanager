import { PrismaClient, Role } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123'

  const passwordHash = await hash(adminPassword, 10)

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: Role.ADMIN },
    create: {
      email: adminEmail,
      name: 'Administrator',
      passwordHash,
      role: Role.ADMIN,
    },
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log('Seed OK: admin user siap')
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })


