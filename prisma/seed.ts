import { prisma } from '../lib/prisma'
import { hash } from 'bcryptjs'
import { randomUUID } from 'crypto'


import { PERMISSION_GROUPS, PERMISSION_GROUPS_MOBILE, ACTIONS, getAllGranularPermissions } from '../lib/permission-config'

// Flatten resources from both admin and mobile groups
// Handle mixed types: some are string[], others are { resources: string[] }
const ADMIN_RESOURCES = Object.values(PERMISSION_GROUPS).flatMap(group => {
  if (Array.isArray(group)) {
    return group
  }
  return (group as { resources?: string[] }).resources || []
})
const MOBILE_RESOURCES = Object.values(PERMISSION_GROUPS_MOBILE).flat()
const ALL_RESOURCES = [...new Set([...ADMIN_RESOURCES, ...MOBILE_RESOURCES])]

async function main() {
  console.log('🌱 Seeding database...\n')

  // ========================================================================
  // STEP 1: PERMISSIONS (WAJIB untuk Autentikasi)
  // ========================================================================
  console.log('📋 STEP 1: Creating Permissions...')
  const permissions = []
  const karyawanPermissions = []

  // 1.1 Standard Permissions (resource:action combinations)
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

      // Track mobile permissions separately
      if ((MOBILE_RESOURCES as readonly string[]).includes(resource)) {
        // Filter eksplisit: m_work_order tidak boleh otomatis diberikan ke Teknisi/Karyawan
        // Permission ini sekarang ada di grup BERANDA (agar muncul di Matrix), tapi default-nya dimatikan untuk role Teknisi
        if (resource !== 'm_work_order') {
          karyawanPermissions.push(permission)
        }
      }
    }
  }

  console.log(`   ✅ Created ${permissions.length} standard permissions`)

  // 1.2 Granular Permissions (resource:action:subaction format)
  const granularPermissionValues = getAllGranularPermissions()

  for (const permValue of granularPermissionValues) {
    // Parse format: 'users:update:role' -> resource='users', action='update:role'
    const parts = permValue.split(':')
    const resource = parts[0]
    const action = parts.slice(1).join(':') // 'update:role' or 'assign_super_admin'

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
        name: `${action.split(':').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')} ${resource.charAt(0).toUpperCase() + resource.slice(1)}`,
        resource,
        action,
        description: `Granular permission: ${permValue}`,
      },
    })
    permissions.push(permission)
  }

  console.log(`   ✅ Created ${granularPermissionValues.length} granular permissions`)
  console.log(`      - Total: ${permissions.length} permissions`)

  // ========================================================================
  // STEP 2: ROLES (WAJIB untuk Autentikasi)
  // ========================================================================
  console.log('\n👥 STEP 2: Creating Roles...')

  // 2.1 SUPER_ADMIN Role - Full access to everything
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {
      accessAdminPanel: true,
      accessEmployeePanel: true,
      isSuperAdmin: true, // Mark as Super Admin
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
      isSuperAdmin: true, // Mark as Super Admin
      permission: {
        connect: permissions.map((p) => ({ id: p.id })),
      },
    },
  })
  console.log(`   ✅ Role: SUPER_ADMIN (${permissions.length} permissions)`)

  // 2.2 ADMIN Role - Admin panel only (no mobile permissions)
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {
      accessAdminPanel: true,
      accessEmployeePanel: false,
      permission: {
        set: [], // Clear existing
        connect: permissions
          .filter((p) => !(MOBILE_RESOURCES as string[]).includes(p.resource as string))
          .map((p) => ({ id: p.id })),
      },
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'ADMIN',
      description: 'Administrator - Admin Panel Access Only',
      accessAdminPanel: true,
      accessEmployeePanel: false,
      permission: {
        connect: permissions
          .filter((p) => !(MOBILE_RESOURCES as string[]).includes(p.resource as string))
          .map((p) => ({ id: p.id })),
      },
    },
  })
  console.log(`   ✅ Role: ADMIN (${permissions.length - karyawanPermissions.length} permissions)`)

  // 2.3 TEKNISI Role - Employee panel only (mobile permissions)
  const teknisiRole = await prisma.role.upsert({
    where: { name: 'TEKNISI' },
    update: {
      accessAdminPanel: false,
      accessEmployeePanel: true,
      permission: {
        set: [], // Clear existing
        connect: karyawanPermissions
          .map((p) => ({ id: p.id })),
      },
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'TEKNISI',
      description: 'Field Technician - Employee Portal Access',
      accessAdminPanel: false,
      accessEmployeePanel: true,
      permission: {
        connect: karyawanPermissions
          .map((p) => ({ id: p.id })),
      },
    },
  })
  console.log(`   ✅ Role: TEKNISI (${karyawanPermissions.length} permissions)`)

  // 2.4 SALES Role - Employee panel only (marketing permissions)
  const salesRole = await prisma.role.upsert({
    where: { name: 'SALES' },
    update: {
      accessAdminPanel: false,
      accessEmployeePanel: true,
      permission: {
        set: [], // Clear existing
        connect: karyawanPermissions
          .filter(
            (p) =>
              p.resource.includes('marketing') ||
              p.resource.includes('canvasing') ||
              p.resource.includes('dashboard')
          )
          .map((p) => ({ id: p.id })),
      },
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'SALES',
      description: 'Sales Representative - Employee Portal Access',
      accessAdminPanel: false,
      accessEmployeePanel: true,
      permission: {
        connect: karyawanPermissions
          .filter(
            (p) =>
              p.resource.includes('marketing') ||
              p.resource.includes('canvasing') ||
              p.resource.includes('dashboard')
          )
          .map((p) => ({ id: p.id })),
      },
    },
  })
  console.log(`   ✅ Role: SALES (marketing/canvasing permissions)`)

  // 2.5 FINANCE Role - Admin panel only (finance permissions)
  const financePermissions = permissions.filter(
    (p) =>
      p.resource.includes('finance') ||
      p.resource.includes('daily_income') ||
      p.resource.includes('period_income') ||
      p.resource.includes('expense') ||
      p.resource.includes('profit_loss') ||
      p.resource === 'dashboard'
  )

  const financeRole = await prisma.role.upsert({
    where: { name: 'FINANCE' },
    update: {
      accessAdminPanel: true,
      accessEmployeePanel: false,
      permission: {
        set: [], // Clear existing
        connect: financePermissions.map((p) => ({ id: p.id })),
      },
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'FINANCE',
      description: 'Finance Officer - Admin Panel Access',
      accessAdminPanel: true,
      accessEmployeePanel: false,
      permission: {
        connect: financePermissions.map((p) => ({ id: p.id })),
      },
    },
  })
  console.log(`   ✅ Role: FINANCE (${financePermissions.length} permissions)`)

  // ========================================================================
  // STEP 3: DEPARTMENTS (Opsional tapi Direkomendasikan)
  // ========================================================================
  console.log('\n🏢 STEP 3: Creating Departments...')

  const technicalDept = await prisma.departments.upsert({
    where: { name: 'Technical' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'Technical',
      description: 'Technical Support & Network Operations',
      jobDescription: 'Mengelola infrastruktur jaringan dan dukungan teknis',
    },
  })
  console.log('   ✅ Department: Technical')

  await prisma.departments.upsert({
    where: { name: 'Customer Service' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'Customer Service',
      description: 'Customer Support & Relations',
      jobDescription: 'Menangani pertanyaan dan keluhan pelanggan',
    },
  })
  console.log('   ✅ Department: Customer Service')

  const operationsDept = await prisma.departments.upsert({
    where: { name: 'Operations' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'Operations',
      description: 'Field Operations & Maintenance',
      jobDescription: 'Operasi lapangan dan pemeliharaan jaringan',
    },
  })
  console.log('   ✅ Department: Operations')

  const financeDept = await prisma.departments.upsert({
    where: { name: 'Finance' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'Finance',
      description: 'Finance & Accounting',
      jobDescription: 'Mengelola keuangan dan akuntansi',
    },
  })
  console.log('   ✅ Department: Finance')

  const marketingDept = await prisma.departments.upsert({
    where: { name: 'Marketing' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'Marketing',
      description: 'Marketing & Sales',
      jobDescription: 'Pemasaran dan penjualan',
    },
  })
  console.log('   ✅ Department: Marketing')

  await prisma.departments.upsert({
    where: { name: 'HR' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: 'HR',
      description: 'Human Resources',
      jobDescription: 'Manajemen sumber daya manusia',
    },
  })
  console.log('   ✅ Department: HR')

  // ========================================================================
  // STEP 4: SITES (Opsional tapi Direkomendasikan)
  // ========================================================================
  console.log('\n📍 STEP 4: Creating Sites...')

  const hqSite = await prisma.sites.upsert({
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

  const jkt01Site = await prisma.sites.upsert({
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

  // ========================================================================
  // STEP 5: POSITIONS (Opsional)
  // ========================================================================
  console.log('\n💼 STEP 5: Creating Positions...')

  await prisma.positions.upsert({
    where: { title: 'Administrator' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      title: 'Administrator',
      code: 'ADMIN',
      departmentId: technicalDept.id
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
      departmentId: technicalDept.id
    },
  })
  console.log('   ✅ Position: Teknisi')

  await prisma.positions.upsert({
    where: { title: 'Sales Representative' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      title: 'Sales Representative',
      code: 'SALES',
      departmentId: marketingDept.id
    },
  })
  console.log('   ✅ Position: Sales Representative')

  await prisma.positions.upsert({
    where: { title: 'Finance Officer' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      title: 'Finance Officer',
      code: 'FIN',
      departmentId: financeDept.id
    },
  })
  console.log('   ✅ Position: Finance Officer')

  // ========================================================================
  // STEP 6: GUDANG (Warehouse)
  // ========================================================================
  console.log('\n📦 STEP 6: Creating Gudang...')

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
    where: { id: hqSite.id },
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
    where: { id: jkt01Site.id },
    data: { gudang: { connect: [{ id: gudangJkt01.id }] } }
  })
  console.log('   ✅ Gudang: GDG-JKT01 (Gudang Jakarta Selatan)')

  // ========================================================================
  // STEP 7: SETTINGS
  // ========================================================================
  console.log('\n⚙️ STEP 7: Creating Settings...')

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

  // ========================================================================
  // STEP 8: USERS (WAJIB untuk Autentikasi)
  // ========================================================================
  console.log('\n👤 STEP 8: Creating Users...')

  // 8.1 SUPER_ADMIN User
  const adminPasswordHash = await hash('admin123', 10)
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      email: 'admin@example.com',
      name: 'System Administrator',
      passwordHash: adminPasswordHash,
      phone: '+62812-0000-0001',
      departmentId: technicalDept.id,
      siteId: hqSite.id,
      isActive: true,
      roleId: superAdminRole.id,
      workingHourMode: 'FIXED',
      startWorkTime: '09:00',
      endWorkTime: '17:00',
      workDays: 'Mon,Tue,Wed,Thu,Fri',
    },
  })
  console.log('   ✅ User: admin@example.com (Role: SUPER_ADMIN)')

  // 8.2 ADMIN User
  const admin2PasswordHash = await hash('admin2', 10)
  await prisma.user.upsert({
    where: { email: 'admin2@example.com' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      email: 'admin2@example.com',
      name: 'Office Administrator',
      passwordHash: admin2PasswordHash,
      phone: '+62812-0000-0002',
      departmentId: operationsDept.id,
      siteId: hqSite.id,
      isActive: true,
      roleId: adminRole.id,
      workingHourMode: 'FIXED',
      startWorkTime: '09:00',
      endWorkTime: '17:00',
      workDays: 'Mon,Tue,Wed,Thu,Fri',
    },
  })
  console.log('   ✅ User: admin2@example.com (Role: ADMIN)')

  // 8.3 TEKNISI User
  const techPasswordHash = await hash('tech123', 10)
  await prisma.user.upsert({
    where: { email: 'teknisi@example.com' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      email: 'teknisi@example.com',
      name: 'Budi Santoso',
      passwordHash: techPasswordHash,
      phone: '+62812-0000-0003',
      departmentId: technicalDept.id,
      siteId: hqSite.id,
      isActive: true,
      roleId: teknisiRole.id,
      workingHourMode: 'FIXED',
      startWorkTime: '08:00',
      endWorkTime: '17:00',
      workDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
    },
  })
  console.log('   ✅ User: teknisi@example.com (Role: TEKNISI)')

  // 8.4 SALES User
  const salesPasswordHash = await hash('sales123', 10)
  await prisma.user.upsert({
    where: { email: 'sales@example.com' },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      email: 'sales@example.com',
      name: 'Ani Wijaya',
      passwordHash: salesPasswordHash,
      phone: '+62812-0000-0004',
      departmentId: marketingDept.id,
      siteId: jkt01Site.id,
      isActive: true,
      roleId: salesRole.id,
      isSales: true,
      canvasingTarget: 50,
      workingHourMode: 'FIXED',
      startWorkTime: '09:00',
      endWorkTime: '17:00',
      workDays: 'Mon,Tue,Wed,Thu,Fri',
    },
  })
  console.log('   ✅ User: sales@example.com (Role: SALES)')

  // 8.5 FINANCE User
  const financePasswordHash = await hash('finance123', 10)
  await prisma.user.upsert({
    where: { email: 'finance@example.com' },
    update: {}, // Empty update ensures we don't restore/overwrite if user exists
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      email: 'finance@example.com',
      name: 'Citra Dewi',
      passwordHash: financePasswordHash,
      phone: '+62812-0000-0005',
      departmentId: financeDept.id,
      siteId: hqSite.id,
      isActive: true,
      roleId: financeRole.id,
      workingHourMode: 'FIXED',
      startWorkTime: '09:00',
      endWorkTime: '17:00',
      workDays: 'Mon,Tue,Wed,Thu,Fri',
    },
  })
  console.log('   ✅ User: finance@example.com (Role: FINANCE)')

  // ========================================================================
  // STEP 8.5: MITRA PARTNERS
  // ========================================================================
  console.log('\n🤝 STEP 8.5: Creating Mitra Partners...')

  const mitraTeknisiHash = await hash('mitratech123', 10)
  await prisma.mitra.upsert({
    where: { email: 'mitrateknisi@example.com' },
    update: {},
    create: {
      name: 'Budi Mitra Teknisi',
      email: 'mitrateknisi@example.com',
      passwordHash: mitraTeknisiHash,
      phone: '081234567891',
      isActive: true,
      siteId: hqSite.id,
      mitraType: 'MITRA_TEKNISI',
      mitraRateWoPsb: 50000,
      mitraRateWoMaintenance: 20000,
      bankName: 'BCA',
      bankAccountNo: '1234567890',
      bankAccountName: 'Budi Mitra Teknisi',
      mitraWallet: {
        create: {
          balance: 0,
          currency: 'IDR'
        }
      }
    }
  })
  console.log('   ✅ Mitra: mitrateknisi@example.com (Type: MITRA_TEKNISI)')

  const mitraSalesHash = await hash('mitrasales123', 10)
  await prisma.mitra.upsert({
    where: { email: 'mitrasales@example.com' },
    update: {},
    create: {
      name: 'Andi Mitra Sales',
      email: 'mitrasales@example.com',
      passwordHash: mitraSalesHash,
      phone: '081234567892',
      isActive: true,
      siteId: jkt01Site.id,
      mitraType: 'MITRA_SALES',
      mitraRateCanvasing: 25000,
      bankName: 'Mandiri',
      bankAccountNo: '0987654321',
      bankAccountName: 'Andi Mitra Sales',
      mitraWallet: {
        create: {
          balance: 0,
          currency: 'IDR'
        }
      }
    }
  })
  console.log('   ✅ Mitra: mitrasales@example.com (Type: MITRA_SALES)')

  // ========================================================================
  // STEP 8.6: INVESTOR PARTNERS
  // ========================================================================
  console.log('\n📈 STEP 8.6: Creating Investor Partners...')

  const investorHash = await hash('investor123', 10)
  await prisma.investor.upsert({
    where: { username: 'investordemo' },
    update: {},
    create: {
      username: 'investordemo',
      password: 'investor123',
      passwordHash: investorHash,
      namaLengkap: 'Bapak Investor',
      perusahaan: 'PT Dana Mandiri',
      noTelp: '081234567899',
      email: 'investor@example.com',
      isActive: true,
    }
  })
  console.log('   ✅ Investor: investordemo (Type: INVESTOR)')

  // ========================================================================
  // STEP 9: VALIDATION
  // ========================================================================
  console.log('\n✅ STEP 9: Validating Authentication Data...')

  // 9.1 Validate Permissions
  const permissionCount = await prisma.permission.count()
  console.log(`   ✅ Permissions: ${permissionCount} records`)
  if (permissionCount === 0) {
    throw new Error('❌ ERROR: No permissions found in database!')
  }

  // 9.2 Validate Roles
  const roleCount = await prisma.role.count()
  console.log(`   ✅ Roles: ${roleCount} records`)
  if (roleCount === 0) {
    throw new Error('❌ ERROR: No roles found in database!')
  }

  // 9.3 Validate Users
  const userCount = await prisma.user.count()
  console.log(`   ✅ Users: ${userCount} records`)
  if (userCount === 0) {
    throw new Error('❌ ERROR: No users found in database!')
  }

  // 9.4 Validate User-Role-Permission chain
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: ['admin@example.com', 'admin2@example.com', 'teknisi@example.com', 'sales@example.com', 'finance@example.com']
      }
    },
    include: {
      role: {
        include: {
          permission: true,
        },
      },
      departments: true,
      sites: true,
    },
  })

  for (const user of users) {
    // Check user has password
    if (!user.passwordHash) {
      console.warn(`   ⚠️  WARNING: User ${user.email} has no passwordHash`)
    }

    // Check user has role
    if (!user.roleId) {
      console.warn(`   ⚠️  WARNING: User ${user.email} has no roleId`)
    } else if (!user.role) {
      console.warn(`   ⚠️  WARNING: User ${user.email} has invalid roleId`)
    } else {
      // Check role has permissions
      if (!user.role.permission || user.role.permission.length === 0) {
        console.warn(`   ⚠️  WARNING: Role ${user.role.name} has no permissions`)
      } else {
        console.log(`   ✅ User ${user.email} -> Role ${user.role.name} -> ${user.role.permission.length} permissions`)
      }
    }
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log('\n' + '='.repeat(60))
  console.log('✅ SEEDING COMPLETED SUCCESSFULLY!')
  console.log('='.repeat(60))
  console.log('\n📊 Summary:')
  console.log(`   Permissions: ${permissionCount}`)
  console.log(`   Roles: ${roleCount}`)
  console.log(`   Departments: ${await prisma.departments.count()}`)
  console.log(`   Sites: ${await prisma.sites.count()}`)
  console.log(`   Positions: ${await prisma.positions.count()}`)
  console.log(`   Gudang: ${await prisma.gudang.count()}`)
  console.log(`   Users: ${userCount}`)
  console.log(`   Investors: ${await prisma.investor.count()}`)
  console.log('\n🔑 Login Credentials:')
  console.log('   ┌────────────────────────────────────────────────────┐')
  console.log('   │ SUPER_ADMIN: admin@example.com / admin123         │')
  console.log('   │ ADMIN:       admin2@example.com / admin2          │')
  console.log('   │ TEKNISI:     teknisi@example.com / tech123        │')
  console.log('   │ SALES:       sales@example.com / sales123         │')
  console.log('   │ FINANCE:     finance@example.com / finance123     │')
  console.log('   │ MITRA TECH:  mitrateknisi@example.com/ mitratech123│')
  console.log('   │ MITRA SALES: mitrasales@example.com/ mitrasales123 │')
  console.log('   │ INVESTOR:    investordemo / investor123            │')
  console.log('   └────────────────────────────────────────────────────┘')
  console.log('\n📝 Portal Access:')
  console.log('   ┌────────────────────────────────────────────────────┐')
  console.log('   │ SUPER_ADMIN:  Admin Panel ✓  Employee Panel ✓     │')
  console.log('   │ ADMIN:        Admin Panel ✓  Employee Panel ✗     │')
  console.log('   │ TEKNISI:      Admin Panel ✗  Employee Panel ✓     │')
  console.log('   │ SALES:        Admin Panel ✗  Employee Panel ✓     │')
  console.log('   │ FINANCE:      Admin Panel ✓  Employee Panel ✗     │')
  console.log('   │ MITRA:        Admin Panel ✗  Mitra App ✓          │')
  console.log('   │ INVESTOR:     Admin Panel ✗  Investor Portal ✓    │')
  console.log('   └────────────────────────────────────────────────────┘')
  console.log('\n✅ All authentication data is ready for login!\n')

  // ========================================================================
  // STEP 10: TREASURY (Financial Accounts)
  // ========================================================================
  console.log('\n💰 STEP 10: Creating Financial Accounts...')

  // Default Cash Account

  const existingCash = await prisma.financialAccount.findFirst({ where: { type: 'CASH' } })
  if (!existingCash) {
    await prisma.financialAccount.create({
      data: {
        name: 'Kas Operasional',
        type: 'CASH',
        description: 'Kas tunai harian di kantor',
        balance: 0,
        isActive: true
      }
    })
    console.log('   ✅ Account: Kas Operasional')
  } else {
    console.log('   ℹ️  Account: Kas Operasional (Already exists)')
  }

  const existingBank = await prisma.financialAccount.findFirst({ where: { type: 'BANK' } })
  if (!existingBank) {
    await prisma.financialAccount.create({
      data: {
        name: 'Bank BCA',
        type: 'BANK',
        accountNumber: '1234567890',
        description: 'Rekening Utama',
        balance: 0,
        isActive: true
      }
    })
    console.log('   ✅ Account: Bank BCA')
  } else {
    console.log('   ℹ️  Account: Bank BCA (Already exists)')
  }

  // ========================================================================
  // STEP 11: INTERNET PACKAGES (Bandwidth, ProfilePPP, HargaPaket)
  // ========================================================================
  console.log('\n🌐 STEP 11: Creating Internet Packages...')

  // 11.1 Bandwidth Profiles
  const band10Data = {
    maxLimitDownload: '10M',
    maxLimitUpload: '2M',
    burstLimitDownload: '15M',
    burstLimitUpload: '3M',
    burstThresholdDownload: '8M',
    burstThresholdUpload: '1500k',
    burstTimeDownload: 15,
    burstTimeUpload: 15,
    minLimitDownload: '5M',
    minLimitUpload: '1M',
    priority: 8,
    downloadSpeed: 10240,
    uploadSpeed: 2048,
    description: 'Paket Basic 10 Mbps',
    status: 'AKTIF' as const,
    siteId: hqSite.id,
    updatedAt: new Date(),
  }
  const band10Mbps = await prisma.bandwidth.upsert({
    where: { name: '10 Mbps' },
    update: band10Data,
    create: { id: randomUUID(), name: '10 Mbps', ...band10Data }
  })
  console.log('   ✅ Bandwidth: 10 Mbps')

  const band20Data = {
    maxLimitDownload: '20M',
    maxLimitUpload: '5M',
    burstLimitDownload: '25M',
    burstLimitUpload: '8M',
    burstThresholdDownload: '15M',
    burstThresholdUpload: '4M',
    burstTimeDownload: 15,
    burstTimeUpload: 15,
    minLimitDownload: '10M',
    minLimitUpload: '2M',
    priority: 8,
    downloadSpeed: 20480,
    uploadSpeed: 5120,
    description: 'Paket Standard 20 Mbps',
    status: 'AKTIF' as const,
    siteId: hqSite.id,
    updatedAt: new Date(),
  }
  const band20Mbps = await prisma.bandwidth.upsert({
    where: { name: '20 Mbps' },
    update: band20Data,
    create: { id: randomUUID(), name: '20 Mbps', ...band20Data }
  })
  console.log('   ✅ Bandwidth: 20 Mbps')

  const band50Data = {
    maxLimitDownload: '50M',
    maxLimitUpload: '10M',
    burstLimitDownload: '60M',
    burstLimitUpload: '15M',
    burstThresholdDownload: '40M',
    burstThresholdUpload: '8M',
    burstTimeDownload: 15,
    burstTimeUpload: 15,
    minLimitDownload: '25M',
    minLimitUpload: '5M',
    priority: 7,
    downloadSpeed: 51200,
    uploadSpeed: 10240,
    description: 'Paket Premium 50 Mbps',
    status: 'AKTIF' as const,
    siteId: hqSite.id,
    updatedAt: new Date(),
  }
  const band50Mbps = await prisma.bandwidth.upsert({
    where: { name: '50 Mbps' },
    update: band50Data,
    create: { id: randomUUID(), name: '50 Mbps', ...band50Data }
  })
  console.log('   ✅ Bandwidth: 50 Mbps')

  // 11.2 Profile PPP
  const pppBasicData = {
    localAddress: '10.10.10.1',
    remoteAddress: 'pool-basic',
    dnsServer: '8.8.8.8,1.1.1.1',
    sessionTimeout: 86400, // 24 hours
    idleTimeout: 3600, // 1 hour
    description: 'Profile PPP untuk paket Basic',
    status: 'AKTIF' as const,
    siteId: hqSite.id,
    updatedAt: new Date(),
  }
  const pppBasic = await prisma.profilePPP.upsert({
    where: { name: 'Profile-Basic' },
    update: pppBasicData,
    create: { id: randomUUID(), name: 'Profile-Basic', ...pppBasicData }
  })
  console.log('   ✅ Profile PPP: Profile-Basic')

  const pppStandardData = {
    localAddress: '10.10.20.1',
    remoteAddress: 'pool-standard',
    dnsServer: '8.8.8.8,1.1.1.1',
    sessionTimeout: 86400,
    idleTimeout: 3600,
    description: 'Profile PPP untuk paket Standard',
    status: 'AKTIF' as const,
    siteId: hqSite.id,
    updatedAt: new Date(),
  }
  const pppStandard = await prisma.profilePPP.upsert({
    where: { name: 'Profile-Standard' },
    update: pppStandardData,
    create: { id: randomUUID(), name: 'Profile-Standard', ...pppStandardData }
  })
  console.log('   ✅ Profile PPP: Profile-Standard')

  const pppPremiumData = {
    localAddress: '10.10.50.1',
    remoteAddress: 'pool-premium',
    dnsServer: '8.8.8.8,1.1.1.1',
    sessionTimeout: 0, // unlimited
    idleTimeout: 3600,
    description: 'Profile PPP untuk paket Premium',
    status: 'AKTIF' as const,
    siteId: hqSite.id,
    updatedAt: new Date(),
  }
  const pppPremium = await prisma.profilePPP.upsert({
    where: { name: 'Profile-Premium' },
    update: pppPremiumData,
    create: { id: randomUUID(), name: 'Profile-Premium', ...pppPremiumData }
  })
  console.log('   ✅ Profile PPP: Profile-Premium')

  // 11.3 Harga Paket
  const pkgBasicData = {
    bandwidthId: band10Mbps.id,
    profilePPPId: pppBasic.id,
    harga: 150000,
    durasi: 30,
    durasiUnit: 'HARI' as const,
    usePPN: true,
    ppnPercentage: 11,
    description: 'Paket internet ekonomis 10 Mbps',
    featured: false,
    status: 'AKTIF' as const,
    siteId: hqSite.id,
    updatedAt: new Date(),
  }
  await prisma.hargaPaket.upsert({
    where: { name_siteId: { name: 'Paket Basic 10 Mbps', siteId: hqSite.id } },
    update: pkgBasicData,
    create: {
      id: randomUUID(),
      name: 'Paket Basic 10 Mbps',
      ...pkgBasicData
    }
  })
  console.log('   ✅ Harga Paket: Paket Basic 10 Mbps')

  const pkgStandardData = {
    bandwidthId: band20Mbps.id,
    profilePPPId: pppStandard.id,
    harga: 250000,
    durasi: 30,
    durasiUnit: 'HARI' as const,
    usePPN: true,
    ppnPercentage: 11,
    description: 'Paket internet kencang 20 Mbps',
    featured: true,
    status: 'AKTIF' as const,
    siteId: hqSite.id,
    updatedAt: new Date(),
  }
  await prisma.hargaPaket.upsert({
    where: { name_siteId: { name: 'Paket Standard 20 Mbps', siteId: hqSite.id } },
    update: pkgStandardData,
    create: {
      id: randomUUID(),
      name: 'Paket Standard 20 Mbps',
      ...pkgStandardData
    }
  })
  console.log('   ✅ Harga Paket: Paket Standard 20 Mbps')

  const pkgPremiumData = {
    bandwidthId: band50Mbps.id,
    profilePPPId: pppPremium.id,
    harga: 450000,
    durasi: 30,
    durasiUnit: 'HARI' as const,
    usePPN: true,
    ppnPercentage: 11,
    description: 'Paket internet super cepat 50 Mbps',
    featured: true,
    status: 'AKTIF' as const,
    siteId: hqSite.id,
    updatedAt: new Date(),
  }
  await prisma.hargaPaket.upsert({
    where: { name_siteId: { name: 'Paket Premium 50 Mbps', siteId: hqSite.id } },
    update: pkgPremiumData,
    create: {
      id: randomUUID(),
      name: 'Paket Premium 50 Mbps',
      ...pkgPremiumData
    }
  })
  console.log('   ✅ Harga Paket: Paket Premium 50 Mbps')

  // ========================================================================
  // STEP 12: NETWORK MAP (Initial Data)
  // ========================================================================
  console.log('\n🗺️ STEP 12: Seeding Network Map...')

  // 11.1 Map Settings
  await prisma.mapSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      centerLat: '-6.2088',
      centerLng: '106.8456',
      defaultZoom: '13',
    }
  })
  console.log('   ✅ Map Settings: Default Jakarta')

  // 11.2 Mapping Nodes (ODC & ODP)
  await prisma.mappingNode.upsert({
    where: { nodeId: 'ODC-HQ' },
    update: {},
    create: {
      nodeId: 'ODC-HQ',
      name: 'ODC Headquarters',
      type: 'odc',
      latitude: -6.2088,
      longitude: 106.8456,
      capacity: 144
    }
  })
  console.log('   ✅ Node: ODC-HQ')

  await prisma.mappingNode.upsert({
    where: { nodeId: 'ODP-JKT01-01' },
    update: {},
    create: {
      nodeId: 'ODP-JKT01-01',
      name: 'ODP Sudirman 01',
      type: 'odp',
      latitude: -6.2100,
      longitude: 106.8400,
      capacity: 16
    }
  })
  console.log('   ✅ Node: ODP-JKT01-01')

  await prisma.mappingNode.upsert({
    where: { nodeId: 'ODP-JKT01-02' },
    update: {},
    create: {
      nodeId: 'ODP-JKT01-02',
      name: 'ODP Thamrin 02',
      type: 'odp',
      latitude: -6.2120,
      longitude: 106.8480,
      capacity: 16
    }
  })
  console.log('   ✅ Node: ODP-JKT01-02')

  // 11.3 Mapping Edges (Fiber Cables)
  await prisma.mappingEdge.upsert({
    where: { edgeId: 'EDGE-001' },
    update: {},
    create: {
      edgeId: 'EDGE-001',
      source: 'ODC-HQ',
      target: 'ODP-JKT01-01',
      fiberType: '48 core',
      distance: 800
    }
  })
  console.log('   ✅ Edge: HQ -> ODP 01')

  await prisma.mappingEdge.upsert({
    where: { edgeId: 'EDGE-002' },
    update: {},
    create: {
      edgeId: 'EDGE-002',
      source: 'ODC-HQ',
      target: 'ODP-JKT01-02',
      fiberType: '24 core',
      distance: 650
    }
  })
  console.log('   ✅ Edge: HQ -> ODP 02')

}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
