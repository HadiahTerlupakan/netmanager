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
    create: { name: 'Technical', description: 'Technical Support' },
  })

  // Create Site
  const site = await prisma.site.upsert({
    where: { code: 'HQ' },
    update: {},
    create: { code: 'HQ', name: 'Headquarters', address: 'Jl. Utama No. 1' },
  })

  // Create Position
  const position = await prisma.position.upsert({
    where: { title: 'Administrator' },
    update: {},
    create: { title: 'Administrator', code: 'ADMIN', departmentId: dept.id },
  })

  // Create User
  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { passwordHash, name: 'Administrator' },
    create: { email: 'admin@example.com', name: 'Administrator', passwordHash },
  })

  // Complete Employee Data
  const employeeData = {
    employeeId: 'EMP-001',
    fullName: 'Administrator',
    email: 'admin@example.com',
    phone: '081234567890',
    departmentId: dept.id,
    positionId: position.id,
    siteId: site.id,
    userId: user.id,
    joinDate: new Date('2024-01-01'),
    status: 'ACTIVE',
    isActive: true,

    // Personal Information
    dateOfBirth: new Date('1990-01-15'),
    gender: 'MALE',
    idCardNumber: '3201234567890001',
    address: 'Jl. Contoh No. 123, RT 01/RW 02, Kelurahan Contoh',
    city: 'Jakarta Selatan',
    province: 'DKI Jakarta',

    // Employment Details
    employmentStatus: 'PERMANENT',
    probationEndDate: new Date('2024-04-01'),

    // Bank Information
    bankName: 'BCA',
    bankAccountNumber: '1234567890',
    bankAccountName: 'ADMINISTRATOR',
    npwp: '12.345.678.9-012.000',

    // Emergency Contact
    emergencyName: 'Keluarga Admin',
    emergencyPhone: '081298765432',
    emergencyRelation: 'Suami/Istri',
  }

  // Check if employee exists
  const existingEmployee = await prisma.employee.findFirst({
    where: { OR: [{ userId: user.id }, { employeeId: 'EMP-001' }] }
  })

  if (existingEmployee) {
    await prisma.employee.update({
      where: { id: existingEmployee.id },
      data: employeeData,
    })
  } else {
    await prisma.employee.create({ data: employeeData })
  }

  console.log('✅ Done!')
  console.log('\n📝 Login: admin@example.com / admin123')
}

main()
  .finally(() => prisma.$disconnect())
