# Comprehensive Authentication Seed Script

> File ini berisi script seed lengkap untuk autentikasi. Copy kode di bawah ini ke `prisma/seed-auth-complete.ts` untuk digunakan.

---

## Seed Script: `prisma/seed-auth-complete.ts`

```typescript
/**
 * COMPREHENSIVE AUTHENTICATION SEED
 *
 * Seed script yang mencakup seluruh dependensi data yang wajib ada
 * untuk autentikasi dan login berhasil.
 *
 * Usage:
 *   npx tsx prisma/seed-auth-complete.ts
 */

import { prisma } from "../lib/prisma";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";

import {
  PERMISSION_GROUPS,
  PERMISSION_GROUPS_MOBILE,
  ACTIONS,
} from "../lib/permission-config";

// Flatten resources from both admin and mobile groups
const ADMIN_RESOURCES = Object.values(PERMISSION_GROUPS).flat();
const MOBILE_RESOURCES = Object.values(PERMISSION_GROUPS_MOBILE).flat();
const ALL_RESOURCES = [...new Set([...ADMIN_RESOURCES, ...MOBILE_RESOURCES])];

async function main() {
  console.log("🌱 Starting Comprehensive Authentication Seed...\n");

  // ========================================================================
  // STEP 1: PERMISSIONS (WAJIB)
  // ========================================================================
  console.log("📋 STEP 1: Creating Permissions...");
  const permissions = [];
  const karyawanPermissions = [];

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
          name: `${action.charAt(0).toUpperCase() + action.slice(1)} ${
            resource.charAt(0).toUpperCase() + resource.slice(1)
          }`,
          resource,
          action,
          description: `Allow ${action} on ${resource}`,
        },
      });
      permissions.push(permission);

      // Track mobile permissions separately
      if ((MOBILE_RESOURCES as readonly string[]).includes(resource)) {
        karyawanPermissions.push(permission);
      }
    }
  }

  console.log(`   ✅ Created ${permissions.length} permissions`);
  console.log(
    `      - Admin permissions: ${
      permissions.length - karyawanPermissions.length
    }`
  );
  console.log(`      - Mobile permissions: ${karyawanPermissions.length}`);

  // ========================================================================
  // STEP 2: ROLES (WAJIB)
  // ========================================================================
  console.log("\n👥 STEP 2: Creating Roles...");

  // 2.1 SUPER_ADMIN Role - Full access to everything
  const superAdminRole = await prisma.role.upsert({
    where: { name: "SUPER_ADMIN" },
    update: {
      accessAdminPanel: true,
      accessEmployeePanel: true,
      permission: {
        set: [], // Clear existing
        connect: permissions.map((p) => ({ id: p.id })),
      },
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: "SUPER_ADMIN",
      description: "Super Administrator with full access to everything",
      accessAdminPanel: true,
      accessEmployeePanel: true,
      permission: {
        connect: permissions.map((p) => ({ id: p.id })),
      },
    },
  });
  console.log(`   ✅ Role: SUPER_ADMIN (${permissions.length} permissions)`);

  // 2.2 ADMIN Role - Admin panel only
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {
      accessAdminPanel: true,
      accessEmployeePanel: false,
      permission: {
        set: [], // Clear existing
        connect: permissions
          .filter((p) => !MOBILE_RESOURCES.includes(p.resource))
          .map((p) => ({ id: p.id })),
      },
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: "ADMIN",
      description: "Administrator - Admin Panel Access Only",
      accessAdminPanel: true,
      accessEmployeePanel: false,
      permission: {
        connect: permissions
          .filter((p) => !MOBILE_RESOURCES.includes(p.resource))
          .map((p) => ({ id: p.id })),
      },
    },
  });
  console.log(
    `   ✅ Role: ADMIN (${
      permissions.length - karyawanPermissions.length
    } permissions)`
  );

  // 2.3 TEKNISI Role - Employee panel only (mobile permissions)
  const teknisiRole = await prisma.role.upsert({
    where: { name: "TEKNISI" },
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
      name: "TEKNISI",
      description: "Field Technician - Employee Portal Access",
      accessAdminPanel: false,
      accessEmployeePanel: true,
      permission: {
        connect: karyawanPermissions.map((p) => ({ id: p.id })),
      },
    },
  });
  console.log(
    `   ✅ Role: TEKNISI (${karyawanPermissions.length} permissions)`
  );

  // 2.4 SALES Role - Employee panel only (marketing permissions)
  const salesRole = await prisma.role.upsert({
    where: { name: "SALES" },
    update: {
      accessAdminPanel: false,
      accessEmployeePanel: true,
      permission: {
        set: [], // Clear existing
        connect: karyawanPermissions
          .filter(
            (p) =>
              p.resource.includes("marketing") ||
              p.resource.includes("canvasing") ||
              p.resource.includes("dashboard")
          )
          .map((p) => ({ id: p.id })),
      },
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: "SALES",
      description: "Sales Representative - Employee Portal Access",
      accessAdminPanel: false,
      accessEmployeePanel: true,
      permission: {
        connect: karyawanPermissions
          .filter(
            (p) =>
              p.resource.includes("marketing") ||
              p.resource.includes("canvasing") ||
              p.resource.includes("dashboard")
          )
          .map((p) => ({ id: p.id })),
      },
    },
  });
  console.log(`   ✅ Role: SALES (limited permissions)`);

  // 2.5 FINANCE Role - Admin panel only (finance permissions)
  const financePermissions = permissions.filter(
    (p) =>
      p.resource.includes("finance") ||
      p.resource.includes("daily_income") ||
      p.resource.includes("period_income") ||
      p.resource.includes("expense") ||
      p.resource.includes("profit_loss") ||
      p.resource === "dashboard"
  );

  const financeRole = await prisma.role.upsert({
    where: { name: "FINANCE" },
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
      name: "FINANCE",
      description: "Finance Officer - Admin Panel Access",
      accessAdminPanel: true,
      accessEmployeePanel: false,
      permission: {
        connect: financePermissions.map((p) => ({ id: p.id })),
      },
    },
  });
  console.log(`   ✅ Role: FINANCE (${financePermissions.length} permissions)`);

  // ========================================================================
  // STEP 3: DEPARTMENTS (OPSIONAL TAPI DIREKOMENDASIKAN)
  // ========================================================================
  console.log("\n🏢 STEP 3: Creating Departments...");

  const technicalDept = await prisma.departments.upsert({
    where: { name: "Technical" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: "Technical",
      description: "Technical Support & Network Operations",
      jobDescription: "Mengelola infrastruktur jaringan dan dukungan teknis",
    },
  });
  console.log("   ✅ Department: Technical");

  const csDept = await prisma.departments.upsert({
    where: { name: "Customer Service" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: "Customer Service",
      description: "Customer Support & Relations",
      jobDescription: "Menangani pertanyaan dan keluhan pelanggan",
    },
  });
  console.log("   ✅ Department: Customer Service");

  const operationsDept = await prisma.departments.upsert({
    where: { name: "Operations" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: "Operations",
      description: "Field Operations & Maintenance",
      jobDescription: "Operasi lapangan dan pemeliharaan jaringan",
    },
  });
  console.log("   ✅ Department: Operations");

  const financeDept = await prisma.departments.upsert({
    where: { name: "Finance" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: "Finance",
      description: "Finance & Accounting",
      jobDescription: "Mengelola keuangan dan akuntansi",
    },
  });
  console.log("   ✅ Department: Finance");

  const marketingDept = await prisma.departments.upsert({
    where: { name: "Marketing" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: "Marketing",
      description: "Marketing & Sales",
      jobDescription: "Pemasaran dan penjualan",
    },
  });
  console.log("   ✅ Department: Marketing");

  const hrDept = await prisma.departments.upsert({
    where: { name: "HR" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      name: "HR",
      description: "Human Resources",
      jobDescription: "Manajemen sumber daya manusia",
    },
  });
  console.log("   ✅ Department: HR");

  // ========================================================================
  // STEP 4: SITES (OPSIONAL TAPI DIREKOMENDASIKAN)
  // ========================================================================
  console.log("\n📍 STEP 4: Creating Sites...");

  const hqSite = await prisma.sites.upsert({
    where: { code: "HQ" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      code: "HQ",
      name: "Headquarters",
      address: "Jl. Utama No. 1, Jakarta",
      description: "Kantor Pusat",
      isActive: true,
      attendanceRadius: 100, // 100 meters radius for attendance
    },
  });
  console.log("   ✅ Site: HQ");

  const jkt01Site = await prisma.sites.upsert({
    where: { code: "JKT01" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      code: "JKT01",
      name: "Jakarta Selatan",
      address: "Jl. Sudirman No. 123, Jakarta Selatan",
      description: "Coverage area Jakarta Selatan",
      isActive: true,
      attendanceRadius: 100,
    },
  });
  console.log("   ✅ Site: JKT01");

  const jkt02Site = await prisma.sites.upsert({
    where: { code: "JKT02" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      code: "JKT02",
      name: "Jakarta Utara",
      address: "Jl. Mangga Dua No. 456, Jakarta Utara",
      description: "Coverage area Jakarta Utara",
      isActive: true,
      attendanceRadius: 100,
    },
  });
  console.log("   ✅ Site: JKT02");

  // ========================================================================
  // STEP 5: POSITIONS (OPSIONAL)
  // ========================================================================
  console.log("\n💼 STEP 5: Creating Positions...");

  await prisma.positions.upsert({
    where: { title: "Administrator" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      title: "Administrator",
      code: "ADMIN",
      departmentId: technicalDept.id,
    },
  });
  console.log("   ✅ Position: Administrator");

  await prisma.positions.upsert({
    where: { title: "Teknisi" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      title: "Teknisi",
      code: "TECH",
      departmentId: technicalDept.id,
    },
  });
  console.log("   ✅ Position: Teknisi");

  await prisma.positions.upsert({
    where: { title: "Sales Representative" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      title: "Sales Representative",
      code: "SALES",
      departmentId: marketingDept.id,
    },
  });
  console.log("   ✅ Position: Sales Representative");

  await prisma.positions.upsert({
    where: { title: "Finance Officer" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      title: "Finance Officer",
      code: "FIN",
      departmentId: financeDept.id,
    },
  });
  console.log("   ✅ Position: Finance Officer");

  // ========================================================================
  // STEP 6: GUDANG (OPSIONAL)
  // ========================================================================
  console.log("\n📦 STEP 6: Creating Gudang...");

  const gudangPusat = await prisma.gudang.upsert({
    where: { kode: "GDG-PUSAT" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      kode: "GDG-PUSAT",
      nama: "Gudang Pusat",
      lokasi: "Jl. Utama No. 1, Jakarta",
      isActive: true,
    },
  });
  // Connect gudang to site (many-to-many)
  await prisma.sites.update({
    where: { id: hqSite.id },
    data: { gudang: { connect: [{ id: gudangPusat.id }] } },
  });
  console.log("   ✅ Gudang: GDG-PUSAT (Gudang Pusat)");

  const gudangJkt01 = await prisma.gudang.upsert({
    where: { kode: "GDG-JKT01" },
    update: {},
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      kode: "GDG-JKT01",
      nama: "Gudang Jakarta Selatan",
      lokasi: "Jl. Sudirman No. 123, Jakarta Selatan",
      isActive: true,
    },
  });
  // Connect gudang to site (many-to-many)
  await prisma.sites.update({
    where: { id: jkt01Site.id },
    data: { gudang: { connect: [{ id: gudangJkt01.id }] } },
  });
  console.log("   ✅ Gudang: GDG-JKT01 (Gudang Jakarta Selatan)");

  // ========================================================================
  // STEP 7: USERS (WAJIB)
  // ========================================================================
  console.log("\n👤 STEP 7: Creating Users...");

  // 7.1 SUPER_ADMIN User
  const adminPasswordHash = await hash("admin123", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      passwordHash: adminPasswordHash,
      name: "System Administrator",
      phone: "+62812-0000-0001",
      departmentId: technicalDept.id,
      siteId: hqSite.id,
      isActive: true,
      roleId: superAdminRole.id,
      workingHourMode: "FIXED",
      startWorkTime: "09:00",
      endWorkTime: "17:00",
      workDays: "Mon,Tue,Wed,Thu,Fri",
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      email: "admin@example.com",
      name: "System Administrator",
      passwordHash: adminPasswordHash,
      phone: "+62812-0000-0001",
      departmentId: technicalDept.id,
      siteId: hqSite.id,
      isActive: true,
      roleId: superAdminRole.id,
      workingHourMode: "FIXED",
      startWorkTime: "09:00",
      endWorkTime: "17:00",
      workDays: "Mon,Tue,Wed,Thu,Fri",
      tokenVersion: 0,
    },
  });
  console.log("   ✅ User: admin@example.com (Role: SUPER_ADMIN)");

  // 7.2 ADMIN User
  const admin2PasswordHash = await hash("admin2", 10);
  await prisma.user.upsert({
    where: { email: "admin2@example.com" },
    update: {
      passwordHash: admin2PasswordHash,
      name: "Office Administrator",
      phone: "+62812-0000-0002",
      departmentId: operationsDept.id,
      siteId: hqSite.id,
      isActive: true,
      roleId: adminRole.id,
      workingHourMode: "FIXED",
      startWorkTime: "09:00",
      endWorkTime: "17:00",
      workDays: "Mon,Tue,Wed,Thu,Fri",
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      email: "admin2@example.com",
      name: "Office Administrator",
      passwordHash: admin2PasswordHash,
      phone: "+62812-0000-0002",
      departmentId: operationsDept.id,
      siteId: hqSite.id,
      isActive: true,
      roleId: adminRole.id,
      workingHourMode: "FIXED",
      startWorkTime: "09:00",
      endWorkTime: "17:00",
      workDays: "Mon,Tue,Wed,Thu,Fri",
      tokenVersion: 0,
    },
  });
  console.log("   ✅ User: admin2@example.com (Role: ADMIN)");

  // 7.3 TEKNISI User
  const techPasswordHash = await hash("tech123", 10);
  await prisma.user.upsert({
    where: { email: "teknisi@example.com" },
    update: {
      passwordHash: techPasswordHash,
      name: "Budi Santoso",
      phone: "+62812-0000-0003",
      departmentId: technicalDept.id,
      siteId: hqSite.id,
      isActive: true,
      roleId: teknisiRole.id,
      workingHourMode: "FIXED",
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      workDays: "Mon,Tue,Wed,Thu,Fri,Sat",
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      email: "teknisi@example.com",
      name: "Budi Santoso",
      passwordHash: techPasswordHash,
      phone: "+62812-0000-0003",
      departmentId: technicalDept.id,
      siteId: hqSite.id,
      isActive: true,
      roleId: teknisiRole.id,
      workingHourMode: "FIXED",
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      workDays: "Mon,Tue,Wed,Thu,Fri,Sat",
      tokenVersion: 0,
    },
  });
  console.log("   ✅ User: teknisi@example.com (Role: TEKNISI)");

  // 7.4 SALES User
  const salesPasswordHash = await hash("sales123", 10);
  await prisma.user.upsert({
    where: { email: "sales@example.com" },
    update: {
      passwordHash: salesPasswordHash,
      name: "Ani Wijaya",
      phone: "+62812-0000-0004",
      departmentId: marketingDept.id,
      siteId: jkt01Site.id,
      isActive: true,
      roleId: salesRole.id,
      isSales: true,
      canvasingTarget: 50,
      workingHourMode: "FIXED",
      startWorkTime: "09:00",
      endWorkTime: "17:00",
      workDays: "Mon,Tue,Wed,Thu,Fri",
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      email: "sales@example.com",
      name: "Ani Wijaya",
      passwordHash: salesPasswordHash,
      phone: "+62812-0000-0004",
      departmentId: marketingDept.id,
      siteId: jkt01Site.id,
      isActive: true,
      roleId: salesRole.id,
      isSales: true,
      canvasingTarget: 50,
      workingHourMode: "FIXED",
      startWorkTime: "09:00",
      endWorkTime: "17:00",
      workDays: "Mon,Tue,Wed,Thu,Fri",
      tokenVersion: 0,
    },
  });
  console.log("   ✅ User: sales@example.com (Role: SALES)");

  // 7.5 FINANCE User
  const financePasswordHash = await hash("finance123", 10);
  await prisma.user.upsert({
    where: { email: "finance@example.com" },
    update: {
      passwordHash: financePasswordHash,
      name: "Citra Dewi",
      phone: "+62812-0000-0005",
      departmentId: financeDept.id,
      siteId: hqSite.id,
      isActive: true,
      roleId: financeRole.id,
      workingHourMode: "FIXED",
      startWorkTime: "09:00",
      endWorkTime: "17:00",
      workDays: "Mon,Tue,Wed,Thu,Fri",
    },
    create: {
      id: randomUUID(),
      updatedAt: new Date(),
      email: "finance@example.com",
      name: "Citra Dewi",
      passwordHash: financePasswordHash,
      phone: "+62812-0000-0005",
      departmentId: financeDept.id,
      siteId: hqSite.id,
      isActive: true,
      roleId: financeRole.id,
      workingHourMode: "FIXED",
      startWorkTime: "09:00",
      endWorkTime: "17:00",
      workDays: "Mon,Tue,Wed,Thu,Fri",
      tokenVersion: 0,
    },
  });
  console.log("   ✅ User: finance@example.com (Role: FINANCE)");

  // ========================================================================
  // STEP 8: VALIDATION
  // ========================================================================
  console.log("\n✅ STEP 8: Validating Authentication Data...");

  // 8.1 Validate Permissions
  const permissionCount = await prisma.permission.count();
  console.log(`   ✅ Permissions: ${permissionCount} records`);
  if (permissionCount === 0) {
    throw new Error("❌ ERROR: No permissions found in database!");
  }

  // 8.2 Validate Roles
  const roleCount = await prisma.role.count();
  console.log(`   ✅ Roles: ${roleCount} records`);
  if (roleCount === 0) {
    throw new Error("❌ ERROR: No roles found in database!");
  }

  // 8.3 Validate Users
  const userCount = await prisma.user.count();
  console.log(`   ✅ Users: ${userCount} records`);
  if (userCount === 0) {
    throw new Error("❌ ERROR: No users found in database!");
  }

  // 8.4 Validate User-Role-Permission chain
  const users = await prisma.user.findMany({
    include: {
      role: {
        include: {
          permission: true,
        },
      },
      departments: true,
      sites: true,
    },
  });

  for (const user of users) {
    // Check user has password
    if (!user.passwordHash) {
      console.warn(`   ⚠️  WARNING: User ${user.email} has no passwordHash`);
    }

    // Check user has role
    if (!user.roleId) {
      console.warn(`   ⚠️  WARNING: User ${user.email} has no roleId`);
    } else if (!user.role) {
      console.warn(`   ⚠️  WARNING: User ${user.email} has invalid roleId`);
    } else {
      // Check role has permissions
      if (!user.role.permission || user.role.permission.length === 0) {
        console.warn(
          `   ⚠️  WARNING: Role ${user.role.name} has no permissions`
        );
      } else {
        console.log(
          `   ✅ User ${user.email} -> Role ${user.role.name} -> ${user.role.permission.length} permissions`
        );
      }
    }

    // Check department if exists
    if (user.departmentId && !user.departments) {
      console.warn(
        `   ⚠️  WARNING: User ${user.email} has invalid departmentId`
      );
    }

    // Check site if exists
    if (user.siteId && !user.sites) {
      console.warn(`   ⚠️  WARNING: User ${user.email} has invalid siteId`);
    }
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log("\n" + "=".repeat(60));
  console.log("✅ COMPREHENSIVE AUTHENTICATION SEED COMPLETED!");
  console.log("=".repeat(60));
  console.log("\n📊 Summary:");
  console.log(`   Permissions: ${permissionCount}`);
  console.log(`   Roles: ${roleCount}`);
  console.log(`   Departments: ${await prisma.departments.count()}`);
  console.log(`   Sites: ${await prisma.sites.count()}`);
  console.log(`   Positions: ${await prisma.positions.count()}`);
  console.log(`   Gudang: ${await prisma.gudang.count()}`);
  console.log(`   Users: ${userCount}`);
  console.log("\n🔑 Login Credentials:");
  console.log("   ┌────────────────────────────────────────────────────┐");
  console.log("   │ SUPER_ADMIN: admin@example.com / admin123       │");
  console.log("   │ ADMIN:        admin2@example.com / admin2        │");
  console.log("   │ TEKNISI:     teknisi@example.com / tech123     │");
  console.log("   │ SALES:        sales@example.com / sales123       │");
  console.log("   │ FINANCE:      finance@example.com / finance123   │");
  console.log("   └────────────────────────────────────────────────────┘");
  console.log("\n📝 Portal Access:");
  console.log("   ┌────────────────────────────────────────────────────┐");
  console.log("   │ SUPER_ADMIN:  Admin Panel ✓  Employee Panel ✓  │");
  console.log("   │ ADMIN:        Admin Panel ✓  Employee Panel ✗  │");
  console.log("   │ TEKNISI:     Admin Panel ✗  Employee Panel ✓  │");
  console.log("   │ SALES:        Admin Panel ✗  Employee Panel ✓  │");
  console.log("   │ FINANCE:      Admin Panel ✓  Employee Panel ✗  │");
  console.log("   └────────────────────────────────────────────────────┘");
  console.log("\n✅ All authentication data is ready for login!\n");
}

main()
  .catch((e) => {
    console.error("\n❌ SEED FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## Cara Menggunakan

### 1. Copy script ke file

```bash
# Copy kode di atas ke file baru
cp plans/SEED_AUTH_COMPLETE.md prisma/seed-auth-complete.ts
```

### 2. Jalankan seed script

```bash
# Reset database (opsional - hati-hati ini akan menghapus semua data)
npx prisma migrate reset --skip-seed

# Jalankan seed script
npx tsx prisma/seed-auth-complete.ts
```

### 3. Verifikasi data

```sql
-- Cek permissions
SELECT COUNT(*) FROM "Permission";

-- Cek roles dengan permissions
SELECT
  r.name,
  COUNT(p.id) as permission_count,
  r."accessAdminPanel",
  r."accessEmployeePanel"
FROM "roles" r
LEFT JOIN "_PermissionToRole" pr ON r.id = pr."roleId"
LEFT JOIN "Permission" p ON pr."permissionId" = p.id
GROUP BY r.id, r.name;

-- Cek users dengan role
SELECT
  u.email,
  u.name,
  u."isActive",
  r.name as role_name,
  d.name as department_name,
  s.name as site_name
FROM "User" u
LEFT JOIN "roles" r ON u."roleId" = r.id
LEFT JOIN "departments" d ON u."departmentId" = d.id
LEFT JOIN "sites" s ON u."siteId" = s.id;
```

---

## Perbedaan dengan Seed Lama

| Fitur              | Seed Lama     | Seed Baru     |
| ------------------ | ------------- | ------------- |
| Validasi data      | ❌ Tidak ada  | ✅ Lengkap    |
| Role lengkap       | 2 roles       | 5 roles       |
| User lengkap       | 2 users       | 5 users       |
| Department lengkap | 3 departments | 6 departments |
| Site lengkap       | 3 sites       | 3 sites       |
| Gudang lengkap     | 2 gudang      | 2 gudang      |
| Position lengkap   | 2 positions   | 4 positions   |
| Error handling     | Minimal       | Komprehensif  |
| Logging            | Basic         | Detail        |

---

## Troubleshooting

### Error: "No permissions found in database!"

**Penyebab:** Permissions tidak ter-create

**Solusi:**

```bash
# Cek apakah permission-config.ts ada
ls lib/permission-config.ts

# Jalankan ulang seed dengan verbose
DEBUG=* npx tsx prisma/seed-auth-complete.ts
```

### Error: "Role has no permissions"

**Penyebab:** Permission connection gagal

**Solusi:**

```sql
-- Cek permission-role connection
SELECT * FROM "_PermissionToRole" LIMIT 10;

-- Jika kosong, jalankan ulang seed
```

### Error: "User has invalid roleId"

**Penyebab:** Role ID tidak valid

**Solusi:**

```sql
-- Cek role exists
SELECT * FROM "roles" WHERE name = 'SUPER_ADMIN';

-- Cek user roleId
SELECT email, "roleId" FROM "User" WHERE email = 'admin@example.com';
```

---

## Next Steps

Setelah seed berhasil:

1. ✅ Test login dengan berbagai role
2. ✅ Verifikasi portal access (admin vs employee)
3. ✅ Test permissions di berbagai fitur
4. ✅ Test force logout dengan tokenVersion
5. ✅ Backup database untuk production

---

## Referensi

- [`AUTHENTICATION_FLOW_ANALYSIS.md`](AUTHENTICATION_FLOW_ANALYSIS.md) - Analisis lengkap alur autentikasi
- [`lib/auth.ts`](../lib/auth.ts) - Konfigurasi NextAuth
- [`lib/permission-config.ts`](../lib/permission-config.ts) - Permission groups
- [`prisma/schema.prisma`](../prisma/schema.prisma) - Database schema
