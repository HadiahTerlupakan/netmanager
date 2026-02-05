/**
 * QA Test Users Seeder
 * 
 * Creates various test users with custom roles for QA/E2E testing.
 * Each user has specific permission sets to test different RBAC scenarios.
 * 
 * Usage:
 *   npx ts-node prisma/seed-qa-users.ts
 */

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as unknown)

// ====== ROLE DEFINITIONS ======
interface RoleDefinition {
  name: string
  description: string
  accessAdminPanel: boolean
  accessEmployeePanel: boolean
  permissions: string[]
}

const QA_ROLES: RoleDefinition[] = [
  {
    name: 'QA_READ_ONLY_ADMIN',
    description: 'Admin dengan akses baca saja',
    accessAdminPanel: true,
    accessEmployeePanel: false,
    permissions: [
      'dashboard:read',
      'list:read',
      'work_order_dashboard:read',
      'pelanggan:read',
      'users:read',
      'roles:read',
      'department:read',
      'site:read',
      'attendance:read',
      'lembur:read',
      'izin:read',
      'holidays:read',
      'support:read',
      'system_log:read',
      'radius:read',
    ],
  },
  {
    name: 'QA_WORKORDER_MANAGER',
    description: 'Manager Work Order - full CRUD',
    accessAdminPanel: true,
    accessEmployeePanel: true,
    permissions: [
      'dashboard:read',
      'list:read', 'list:create', 'list:update', 'list:delete',
      'work_order_dashboard:read',
      'wo_sla:read', 'wo_sla:create', 'wo_sla:update', 'wo_sla:delete',
      'wo_escalation:read', 'wo_escalation:create', 'wo_escalation:update', 'wo_escalation:delete',
      'wo_template:read', 'wo_template:create', 'wo_template:update', 'wo_template:delete',
      'site:read',
      'department:read',
    ],
  },
  {
    name: 'QA_HR_ADMIN',
    description: 'HR Admin - kelola absensi, cuti, lembur',
    accessAdminPanel: true,
    accessEmployeePanel: false,
    permissions: [
      'dashboard:read',
      'users:read',
      'department:read',
      'site:read',
      'attendance:read', 'attendance:create', 'attendance:update', 'attendance:delete',
      'lembur:read', 'lembur:create', 'lembur:update', 'lembur:delete',
      'izin:read', 'izin:create', 'izin:update', 'izin:delete',
      'holiday:read', 'holiday:create', 'holiday:update', 'holiday:delete',
    ],
  },
  {
    name: 'QA_NETWORK_ADMIN',
    description: 'Network Admin - kelola RADIUS',
    accessAdminPanel: true,
    accessEmployeePanel: false,
    permissions: [
      'dashboard:read',
      'radius:read', 'radius:create', 'radius:update', 'radius:delete',
      'pelanggan:read', 'pelanggan:update',
    ],
  },
  {
    name: 'QA_SUPPORT_AGENT',
    description: 'Support Agent - tiket support saja',
    accessAdminPanel: true,
    accessEmployeePanel: false,
    permissions: [
      'dashboard:read',
      'support:read', 'support:create', 'support:update',
      'pelanggan:read',
    ],
  },
  {
    name: 'QA_SITE_MANAGER',
    description: 'Site Manager - sites dan departments',
    accessAdminPanel: true,
    accessEmployeePanel: false,
    permissions: [
      'dashboard:read',
      'site:read', 'site:create', 'site:update', 'site:delete',
      'department:read', 'department:create', 'department:update', 'department:delete',
      'users:read',
    ],
  },
  {
    name: 'QA_FIELD_TECH_PLUS',
    description: 'Teknisi Lapangan Plus',
    accessAdminPanel: false,
    accessEmployeePanel: true,
    permissions: [
      'k_dashboard:read',
      'k_work_order:read', 'k_work_order:update',
      'k_absensi:read', 'k_absensi:create',
      'k_barang:read', 'k_barang:create', 'k_barang:update',
    ],
  },

  {
    name: 'QA_NO_PERMISSION',
    description: 'User tanpa permission untuk test 403',
    accessAdminPanel: true,
    accessEmployeePanel: false,
    permissions: [],
  },
]

// ====== USER DEFINITIONS ======
interface UserDefinition {
  email: string
  name: string
  password: string
  roleName: string
  phone: string
}

const QA_USERS: UserDefinition[] = [
  { email: 'qa.readonly@test.com', name: 'QA Read Only', password: 'qatest123', roleName: 'QA_READ_ONLY_ADMIN', phone: '+62812-0000-1001' },
  { email: 'qa.workorder@test.com', name: 'QA Work Order Manager', password: 'qatest123', roleName: 'QA_WORKORDER_MANAGER', phone: '+62812-0000-1002' },
  { email: 'qa.hr@test.com', name: 'QA HR Admin', password: 'qatest123', roleName: 'QA_HR_ADMIN', phone: '+62812-0000-1003' },
  { email: 'qa.network@test.com', name: 'QA Network Admin', password: 'qatest123', roleName: 'QA_NETWORK_ADMIN', phone: '+62812-0000-1004' },
  { email: 'qa.support@test.com', name: 'QA Support Agent', password: 'qatest123', roleName: 'QA_SUPPORT_AGENT', phone: '+62812-0000-1005' },
  { email: 'qa.sitemanager@test.com', name: 'QA Site Manager', password: 'qatest123', roleName: 'QA_SITE_MANAGER', phone: '+62812-0000-1006' },
  { email: 'qa.fieldtech@test.com', name: 'QA Field Tech Plus', password: 'qatest123', roleName: 'QA_FIELD_TECH_PLUS', phone: '+62812-0000-1007' },

  { email: 'qa.noperm@test.com', name: 'QA No Permission', password: 'qatest123', roleName: 'QA_NO_PERMISSION', phone: '+62812-0000-1008' },
]

async function main() {
  console.log('🧪 Seeding QA Test Users and Roles...\n')

  const defaultDept = await prisma.departments.findFirst()
  const defaultSite = await prisma.sites.findFirst()

  if (!defaultDept || !defaultSite) {
    console.error('❌ Please run the main seed first')
    process.exit(1)
  }

  // Create Roles
  console.log('👥 Creating QA Roles...')
  const roleMap = new Map<string, string>()

  for (const roleDef of QA_ROLES) {
    const permissionRecords = await prisma.permission.findMany({
      where: {
        OR: roleDef.permissions.length > 0 
          ? roleDef.permissions.map((perm) => {
              const [resource, action] = perm.split(':')
              if (!resource) return { id: 'nonexistent' } // Should not happen with valid config
              if (!action) return { resource }
              return { resource, action }
            })
          : [{ id: 'nonexistent' }]
      },
    })

    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {
        description: roleDef.description,
        accessAdminPanel: roleDef.accessAdminPanel,
        accessEmployeePanel: roleDef.accessEmployeePanel,
        permission: {
          set: [],
          connect: permissionRecords.map((p) => ({ id: p.id })),
        },
      },
      create: {
        id: randomUUID(),
        updatedAt: new Date(),
        name: roleDef.name,
        description: roleDef.description,
        accessAdminPanel: roleDef.accessAdminPanel,
        accessEmployeePanel: roleDef.accessEmployeePanel,
        permission: {
          connect: permissionRecords.map((p) => ({ id: p.id })),
        },
      },
    })

    roleMap.set(roleDef.name, role.id)
    console.log(`   ✅ Role: ${roleDef.name} (${permissionRecords.length} permissions)`)
  }

  // Create Users
  console.log('\n👤 Creating QA Users...')

  for (const userDef of QA_USERS) {
    const roleId = roleMap.get(userDef.roleName)
    if (!roleId) continue

    const passwordHash = await hash(userDef.password, 10)

    await prisma.user.upsert({
      where: { email: userDef.email },
      update: {
        name: userDef.name,
        passwordHash,
        phone: userDef.phone,
        roleId,
        isActive: true,
      },
      create: {
        id: randomUUID(),
        updatedAt: new Date(),
        email: userDef.email,
        name: userDef.name,
        passwordHash,
        phone: userDef.phone,
        departmentId: defaultDept.id,
        siteId: defaultSite.id,
        roleId,
        isActive: true,
        workingHourMode: 'FIXED',
        startWorkTime: '09:00',
        endWorkTime: '17:00',
        workDays: 'Mon,Tue,Wed,Thu,Fri',
      },
    })
    console.log(`   ✅ User: ${userDef.email} (${userDef.roleName})`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ QA Seeding completed!')
  console.log('='.repeat(60))
  console.log('\n📝 QA Test Credentials (password: qatest123)')
  console.log('')
  console.log('  qa.readonly@test.com      - Read-Only Admin')
  console.log('  qa.workorder@test.com     - Work Order Full Access')
  console.log('  qa.hr@test.com            - HR/Attendance Admin')
  console.log('  qa.network@test.com       - Network/RADIUS Admin')
  console.log('  qa.support@test.com       - Support Tickets Only')
  console.log('  qa.sitemanager@test.com   - Sites & Departments')
  console.log('  qa.fieldtech@test.com     - Enhanced Field Tech')
  console.log('  qa.noperm@test.com        - No Permissions (403 Test)')
  console.log('')
}

main()
  .catch((e) => {
    console.error('❌ QA Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
