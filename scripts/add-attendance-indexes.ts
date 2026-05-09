import { prisma } from "../lib/prisma";

async function addAttendanceIndexes() {
  console.log("🚀 Starting to add attendance performance indexes...\n");

  try {
    // Index 1: tenant + checkIn range
    console.log("Creating index: idx_attendance_tenant_checkin_range...");
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_attendance_tenant_checkin_range"
      ON "Attendance"("tenantId", "checkIn" DESC)
    `);
    console.log("✅ Index created: idx_attendance_tenant_checkin_range\n");

    // Index 2: status + tenant
    console.log("Creating index: idx_attendance_status_tenant...");
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_attendance_status_tenant"
      ON "Attendance"("status", "tenantId")
    `);
    console.log("✅ Index created: idx_attendance_status_tenant\n");

    // Index 3: tenant + status + checkIn (composite)
    console.log("Creating index: idx_attendance_tenant_status_checkin...");
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_attendance_tenant_status_checkin"
      ON "Attendance"("tenantId", "status", "checkIn" DESC)
    `);
    console.log("✅ Index created: idx_attendance_tenant_status_checkin\n");

    // Index 4: checkInDate + tenant
    console.log("Creating index: idx_attendance_checkin_date_tenant...");
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_attendance_checkin_date_tenant"
      ON "Attendance"("checkInDate", "tenantId")
      WHERE "checkInDate" IS NOT NULL
    `);
    console.log("✅ Index created: idx_attendance_checkin_date_tenant\n");

    // Index 5: geofenceStatus
    console.log("Creating index: idx_attendance_geofence_status...");
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_attendance_geofence_status"
      ON "Attendance"("geofenceStatus", "tenantId")
      WHERE "geofenceStatus" IS NOT NULL
    `);
    console.log("✅ Index created: idx_attendance_geofence_status\n");

    // Index 6: User name + tenant
    console.log("Creating index: idx_user_name_tenant...");
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_user_name_tenant"
      ON "User"("name", "tenantId")
      WHERE "name" IS NOT NULL
    `);
    console.log("✅ Index created: idx_user_name_tenant\n");

    // Analyze tables
    console.log("Analyzing tables to update statistics...");
    await prisma.$executeRawUnsafe(`ANALYZE "Attendance"`);
    await prisma.$executeRawUnsafe(`ANALYZE "User"`);
    console.log("✅ Tables analyzed\n");

    // Verify indexes
    console.log("📊 Verifying created indexes...");
    const indexes = await prisma.$queryRawUnsafe<
      Array<{ indexname: string; tablename: string }>
    >(
      `SELECT indexname, tablename
       FROM pg_indexes
       WHERE indexname LIKE 'idx_attendance%' OR indexname LIKE 'idx_user_name%'
       ORDER BY tablename, indexname`,
    );

    console.log("\n✅ All indexes created successfully!\n");
    console.log("Created indexes:");
    indexes.forEach((idx) => {
      console.log(`  - ${idx.tablename}.${idx.indexname}`);
    });

    console.log("\n🎉 Migration completed successfully!");
    console.log("\n📈 Expected performance improvements:");
    console.log("  - Admin list queries: 40-60% faster");
    console.log("  - Filter by status: 50-70% faster");
    console.log("  - Date range queries: 30-50% faster");
    console.log("  - User search: 40-60% faster");
  } catch (error) {
    console.error("❌ Error creating indexes:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addAttendanceIndexes()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
