import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

import { PERMISSION_GROUPS, PERMISSION_GROUPS_KARYAWAN, ACTIONS } from '../lib/permission-config'

// Flatten resources from both admin and karyawan groups
const ADMIN_RESOURCES = Object.values(PERMISSION_GROUPS).flat()
const KARYAWAN_RESOURCES = Object.values(PERMISSION_GROUPS_KARYAWAN).flat()
const ALL_RESOURCES = [...new Set([...ADMIN_RESOURCES, ...KARYAWAN_RESOURCES])]

async function main() {
  console.log('🌱 Seeding database...\n')

  // --- 1. RBAC Setup ---
  console.log('📋 Creating permissions...')
  const permissions = []
  const karyawanPermissions = []

  // 1a. Seed Permissions from PERMISSION_GROUPS (Legacy/Granular)
  for (const resource of ALL_RESOURCES) {
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
          id: randomUUID(),
          updatedAt: new Date(),
          name: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource.charAt(0).toUpperCase() + resource.slice(1)}`,
          resource,
          action,
          description: `Allow ${action} on ${resource}`,
        },
      })
      permissions.push(permission)

      // Track karyawan permissions separately
      if ((KARYAWAN_RESOURCES as readonly string[]).includes(resource)) {
        karyawanPermissions.push(permission)
      }
    }
  }

  console.log(`   ✅ Synced ${permissions.length} permissions.`)

  console.log('👥 Creating Roles...')
  // Create SUPER_ADMIN Role
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {
      accessAdminPanel: true,
      accessEmployeePanel: true,
      permission: {
        set: [], // Clear existing to ensure clean slate before connecting all
        connect: permissions.map((p) => ({ id: p.id })),
      },
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'SUPER_ADMIN',
      description: 'Super Administrator with full access to everything',
      accessAdminPanel: true,
      accessEmployeePanel: true,
      permission: {
        connect: permissions.map((p) => ({ id: p.id })),
      },
    },
  })
  console.log('   ✅ Role: SUPER_ADMIN')

  // Create Teknisi Role with karyawan permissions
  const teknisiRole = await prisma.role.upsert({
    where: { name: 'teknisi' },
    update: {
      accessAdminPanel: false,
      accessEmployeePanel: true,
      permission: {
        set: [], // Clear existing
        connect: karyawanPermissions.map((p) => ({ id: p.id })),
      },
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'teknisi',
      description: 'Field Technician - Employee Portal Access',
      accessAdminPanel: false,
      accessEmployeePanel: true,
      permission: {
        connect: karyawanPermissions.map((p) => ({ id: p.id })),
      },
    },
  })
  console.log('   ✅ Role: teknisi (with karyawan permissions)')


  // --- 2. Organization Setup ---
  console.log('\n🏢 Setting up Organization...')

  const passwordHash = await hash('admin123', 10)

  // Create Department
  const dept = await prisma.departments.upsert({
    where: { name: 'Technical' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'Technical',
      description: 'Technical Support & Network Operations',
      jobDescription: 'Mengelola infrastruktur jaringan dan dukungan teknis'
    },
  })
  console.log('   ✅ Department: Technical')

  // Create additional departments
  await prisma.departments.upsert({
    where: { name: 'Customer Service' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'Customer Service',
      description: 'Customer Support & Relations',
      jobDescription: 'Menangani pertanyaan dan keluhan pelanggan'
    },
  })
  console.log('   ✅ Department: Customer Service')

  await prisma.departments.upsert({
    where: { name: 'Operations' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'Operations',
      description: 'Field Operations & Maintenance',
      jobDescription: 'Operasi lapangan dan pemeliharaan jaringan'
    },
  })
  console.log('   ✅ Department: Operations')

  // Create Site
  const site = await prisma.sites.upsert({
    where: { code: 'HQ' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      code: 'HQ',
      name: 'Headquarters',
      address: 'Jl. Utama No. 1, Jakarta',
      description: 'Kantor Pusat',
      isActive: true,
      attendanceRadius: 100, // 100 meters radius for attendance
    },
  })
  console.log('   ✅ Site: HQ')

  // Create additional sites
  const siteJkt01 = await prisma.sites.upsert({
    where: { code: 'JKT01' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      code: 'JKT01',
      name: 'Jakarta Selatan',
      address: 'Jl. Sudirman No. 123, Jakarta Selatan',
      description: 'Coverage area Jakarta Selatan',
      isActive: true,
      attendanceRadius: 100,
    },
  })
  console.log('   ✅ Site: JKT01')

  await prisma.sites.upsert({
    where: { code: 'JKT02' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      code: 'JKT02',
      name: 'Jakarta Utara',
      address: 'Jl. Mangga Dua No. 456, Jakarta Utara',
      description: 'Coverage area Jakarta Utara',
      isActive: true,
      attendanceRadius: 100,
    },
  })
  console.log('   ✅ Site: JKT02')

  // Create Position
  await prisma.positions.upsert({
    where: { title: 'Administrator' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      title: 'Administrator',
      code: 'ADMIN',
      departmentId: dept.id
    },
  })
  console.log('   ✅ Position: Administrator')

  await prisma.positions.upsert({
    where: { title: 'Teknisi' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      title: 'Teknisi',
      code: 'TECH',
      departmentId: dept.id
    },
  })
  console.log('   ✅ Position: Teknisi')

  // --- 3. Gudang (Warehouse) Setup ---
  console.log('\n📦 Setting up Warehouses...')

  const gudangPusat = await prisma.gudang.upsert({
    where: { kode: 'GDG-PUSAT' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      kode: 'GDG-PUSAT',
      nama: 'Gudang Pusat',
      lokasi: 'Jl. Utama No. 1, Jakarta',
      isActive: true,
    },
  })
  // Connect gudang to site (many-to-many)
  await prisma.sites.update({
    where: { id: site.id },
    data: { gudang: { connect: [{ id: gudangPusat.id }] } }
  })
  console.log('   ✅ Gudang: GDG-PUSAT (Gudang Pusat)')

  const gudangJkt01 = await prisma.gudang.upsert({
    where: { kode: 'GDG-JKT01' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      kode: 'GDG-JKT01',
      nama: 'Gudang Jakarta Selatan',
      lokasi: 'Jl. Sudirman No. 123, Jakarta Selatan',
      isActive: true,
    },
  })
  // Connect gudang to site (many-to-many)
  await prisma.sites.update({
    where: { id: siteJkt01.id },
    data: { gudang: { connect: [{ id: gudangJkt01.id }] } }
  })
  console.log('   ✅ Gudang: GDG-JKT01 (Gudang Jakarta Selatan)')

  // --- 4. Settings Setup ---
  console.log('\n⚙️ Setting up Application Settings...')

  const settingsData = [
    { key: 'namaAplikasi', value: 'NetManager', description: 'Nama aplikasi' },
    { key: 'namaPerusahaan', value: 'PT. Network Solutions', description: 'Nama perusahaan' },
    { key: 'alamatPerusahaan', value: 'Jl. Utama No. 1, Jakarta', description: 'Alamat perusahaan' },
    { key: 'teleponPerusahaan', value: '+62-21-1234567', description: 'Telepon perusahaan' },
    { key: 'emailPerusahaan', value: 'info@example.com', description: 'Email perusahaan' },
    { key: 'jamMasukKerja', value: '09:00', description: 'Jam masuk kerja default' },
    { key: 'jamKeluarKerja', value: '17:00', description: 'Jam keluar kerja default' },
    { key: 'toleransiTelat', value: '15', description: 'Toleransi keterlambatan dalam menit' },
    { key: 'hariKerja', value: 'Mon,Tue,Wed,Thu,Fri', description: 'Hari kerja (format CSV)' },
    // Timezone settings for deployment consistency
    { key: 'GENERAL_TIMEZONE', value: 'Asia/Jakarta', description: 'Timezone aplikasi (IANA format)' },
    { key: 'GENERAL_ATTENDANCE_TOLERANCE', value: '15', description: 'Toleransi keterlambatan absensi (menit)' },
  ]

  for (const setting of settingsData) {
    await prisma.settings.upsert({
      where: { key: setting.key },
      update: {},
      create: {
         id: randomUUID(),
         ...setting,
         updatedAt: new Date(),
    },
    })
  }
  console.log(`   ✅ Created ${settingsData.length} settings entries`)

  // --- 5. Users Setup ---
  console.log('\n👤 Creating Users...')

  // Create Admin User (with complete data including working hours)
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      passwordHash,
      name: 'System Administrator',
      phone: '+62812-0000-0001',
      departmentId: dept.id,
      siteId: site.id,
      isActive: true,
      roleId: superAdminRole.id,
      workingHourMode: 'FIXED',
      startWorkTime: '09:00',
      endWorkTime: '17:00',
      workDays: 'Mon,Tue,Wed,Thu,Fri',
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      email: 'admin@example.com',
      name: 'System Administrator',
      passwordHash,
      phone: '+62812-0000-0001',
      departmentId: dept.id,
      siteId: site.id,
      isActive: true,
      roleId: superAdminRole.id,
      workingHourMode: 'FIXED',
      startWorkTime: '09:00',
      endWorkTime: '17:00',
      workDays: 'Mon,Tue,Wed,Thu,Fri',
    },
  })
  console.log('   ✅ User: admin@example.com (Role: SUPER_ADMIN)')

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
      roleId: teknisiRole.id,
      workingHourMode: 'FIXED',
      startWorkTime: '08:00',
      endWorkTime: '17:00',
      workDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      email: 'teknisi@example.com',
      name: 'Budi Santoso',
      passwordHash: techPasswordHash,
      phone: '+62812-0000-0002',
      departmentId: dept.id,
      siteId: site.id,
      isActive: true,
      roleId: teknisiRole.id,
      workingHourMode: 'FIXED',
      startWorkTime: '08:00',
      endWorkTime: '17:00',
      workDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
    },
  })
  console.log('   ✅ User: teknisi@example.com (Role: teknisi)')

  console.log('\n✅ Seeding completed!')
  console.log('\n📝 Login credentials:')
  console.log('   Admin:    admin@example.com / admin123')
  console.log('   Teknisi:  teknisi@example.com / tech123')
  console.log('\n📦 Gudang created:')
  console.log('   - GDG-PUSAT (Gudang Pusat)')
  console.log('   - GDG-JKT01 (Gudang Jakarta Selatan)')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
