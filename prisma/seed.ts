import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

const RESOURCES = [
  'dashboard',
  'user',
  'role',
  'finance',
  'network',
  'inventory',
  'ticket',
  'settings',
  'announcement',
  'log',
  'ftth',
  'paket',
  'pelanggan',
  'workorders',
  'support'
]

const ACTIONS = ['read', 'create', 'update', 'delete']

async function main() {
  console.log('🌱 Seeding database...\n')

  // --- 1. RBAC Setup ---
  console.log('   Creating permissions...')
  const permissions = []
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      const permission = await prisma.permission.upsert({
        where: {
          resource_action: {
            resource,
            action,
          },
        },
        update: {},
        create: {
          name: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource.charAt(0).toUpperCase() + resource.slice(1)}`,
          resource,
          action,
          description: `Allow ${action} on ${resource}`,
        },
      })
      permissions.push(permission)
    }
  }
  console.log(`   ✅ Synced ${permissions.length} permissions.`)

  console.log('   Creating Roles...')
  // Create SUPER_ADMIN Role
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {
      accessAdminPanel: true,
      accessEmployeePanel: true,
      permissions: {
        connect: permissions.map((p) => ({ id: p.id })),
      },
    },
    create: {
      name: 'SUPER_ADMIN',
      description: 'Super Administrator with full access to everything',
      accessAdminPanel: true,
      accessEmployeePanel: true,
      permissions: {
        connect: permissions.map((p) => ({ id: p.id })),
      },
    },
  })
  console.log('   ✅ Role: SUPER_ADMIN')

  // Create Teknisi Role
  const teknisiRole = await prisma.role.upsert({
    where: { name: 'teknisi' },
    update: {
      accessAdminPanel: false, // Teknisi default to Employee Portal Only
      accessEmployeePanel: true,
    },
    create: {
      name: 'teknisi',
      description: 'Field Technician',
      accessAdminPanel: false,
      accessEmployeePanel: true,
      // Default permissions for teknisi could be limited here, but for seed we keep it simple or assign specific ones
      // For now we just create the role. Access rights are usually managed via UI later.
    },
  })
  console.log('   ✅ Role: teknisi')


  // --- 2. Organization Setup ---

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
      roleId: superAdminRole.id, // Assign SUPER_ADMIN role
    },
    create: {
      email: 'admin@example.com',
      name: 'System Administrator',
      passwordHash,
      phone: '+62812-0000-0001',
      departmentId: dept.id,
      siteId: site.id,
      isActive: true,
      roleId: superAdminRole.id, // Assign SUPER_ADMIN role
    },
  })
  console.log('✅ User: admin@example.com (Role: SUPER_ADMIN)')

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
      roleId: teknisiRole.id, // Assign teknisi role
    },
    create: {
      email: 'teknisi@example.com',
      name: 'Budi Santoso',
      passwordHash: techPasswordHash,
      phone: '+62812-0000-0002',
      departmentId: dept.id,
      siteId: site.id,
      isActive: true,
      roleId: teknisiRole.id, // Assign teknisi role
    },
  })
  console.log('✅ User: teknisi@example.com (Role: teknisi)')

  console.log('\n✅ Seeding completed!')
  console.log('\n📝 Login credentials:')
  console.log('   Admin:    admin@example.com / admin123')
  console.log('   Teknisi:  teknisi@example.com / tech123')
}

main()
  .finally(() => prisma.$disconnect())
