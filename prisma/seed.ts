import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...\n')

  const passwordHash = await hash('admin123', 10)

  // Create Department
  const dept = await prisma.department.upsert({
    where: { name: 'Technical' },
    update: {},
    create: {
      name: 'Technical',
      description: 'Technical Support & Network Operations',
      jobDescription: 'Mengelola infrastruktur jaringan dan dukungan teknis'
    },
  })
  console.log('✅ Department: Technical')

  // Create additional departments
  await prisma.department.upsert({
    where: { name: 'Customer Service' },
    update: {},
    create: {
      name: 'Customer Service',
      description: 'Customer Support & Relations',
      jobDescription: 'Menangani pertanyaan dan keluhan pelanggan'
    },
  })
  console.log('✅ Department: Customer Service')

  await prisma.department.upsert({
    where: { name: 'Operations' },
    update: {},
    create: {
      name: 'Operations',
      description: 'Field Operations & Maintenance',
      jobDescription: 'Operasi lapangan dan pemeliharaan jaringan'
    },
  })
  console.log('✅ Department: Operations')

  // Create Site
  const site = await prisma.site.upsert({
    where: { code: 'HQ' },
    update: {},
    create: {
      code: 'HQ',
      name: 'Headquarters',
      address: 'Jl. Utama No. 1, Jakarta',
      description: 'Kantor Pusat',
      isActive: true
    },
  })
  console.log('✅ Site: HQ')

  // Create additional sites
  await prisma.site.upsert({
    where: { code: 'JKT01' },
    update: {},
    create: {
      code: 'JKT01',
      name: 'Jakarta Selatan',
      address: 'Jl. Sudirman No. 123, Jakarta Selatan',
      description: 'Coverage area Jakarta Selatan',
      isActive: true
    },
  })
  console.log('✅ Site: JKT01')

  await prisma.site.upsert({
    where: { code: 'JKT02' },
    update: {},
    create: {
      code: 'JKT02',
      name: 'Jakarta Utara',
      address: 'Jl. Mangga Dua No. 456, Jakarta Utara',
      description: 'Coverage area Jakarta Utara',
      isActive: true
    },
  })
  console.log('✅ Site: JKT02')

  // Create Position
  await prisma.position.upsert({
    where: { title: 'Administrator' },
    update: {},
    create: {
      title: 'Administrator',
      code: 'ADMIN',
      departmentId: dept.id
    },
  })
  console.log('✅ Position: Administrator')

  await prisma.position.upsert({
    where: { title: 'Teknisi' },
    update: {},
    create: {
      title: 'Teknisi',
      code: 'TECH',
      departmentId: dept.id
    },
  })
  console.log('✅ Position: Teknisi')

  // Create Admin User (with complete data)
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      passwordHash,
      name: 'System Administrator',
      phone: '+62812-0000-0001',
      departmentId: dept.id,
      siteId: site.id,
      isActive: true,
    },
    create: {
      email: 'admin@example.com',
      name: 'System Administrator',
      passwordHash,
      phone: '+62812-0000-0001',
      departmentId: dept.id,
      siteId: site.id,
      isActive: true,
    },
  })
  console.log('✅ User: admin@example.com (Admin)')

  // Create Technician User
  const techPasswordHash = await hash('tech123', 10)
  await prisma.user.upsert({
    where: { email: 'teknisi@example.com' },
    update: {
      passwordHash: techPasswordHash,
      name: 'Budi Santoso',
      phone: '+62812-0000-0002',
      departmentId: dept.id,
      siteId: site.id,
      isActive: true,
    },
    create: {
      email: 'teknisi@example.com',
      name: 'Budi Santoso',
      passwordHash: techPasswordHash,
      phone: '+62812-0000-0002',
      departmentId: dept.id,
      siteId: site.id,
      isActive: true,
    },
  })
  console.log('✅ User: teknisi@example.com (Technician)')

  console.log('\n✅ Seeding completed!')
  console.log('\n📝 Login credentials:')
  console.log('   Admin:    admin@example.com / admin123')
  console.log('   Teknisi:  teknisi@example.com / tech123')
}

main()
  .finally(() => prisma.$disconnect())
