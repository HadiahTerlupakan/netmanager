import { PrismaClient, Prisma } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { MAIN_TENANT_NAME } from "../modules/mitra/services/tenant-constants";

/**
 * Script ini bersifat IDEMPOTENT (aman dijalankan berkali-kali).
 * Safety net untuk memastikan tenant NETMANAGER ada dan data legacy tertaut.
 *
 * Berjalan SETELAH backfill-tenant.ts sehingga tenant sudah ada/direname.
 * Script ini TIDAK membuat tenant baru atau mengubah ID.
 */

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL tidak ditemukan di .env");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("🚀 [migrate-legacy-tenant] Checking for orphaned data...");

  let optionalFailureCount = 0;

  try {
    // Cari tenant NETMANAGER (sudah dibuat/direname oleh backfill-tenant.ts)
    let tenant = await prisma.tenant.findFirst({
      where: { name: MAIN_TENANT_NAME },
    });

    if (!tenant) {
      // Fallback: cari tenant apapun yang paling lama
      tenant = await prisma.tenant.findFirst({
        orderBy: { createdAt: "asc" },
      });
    }

    if (!tenant) {
      console.log("⚠️ No tenant found. Skipping legacy migration.");
      return;
    }

    console.log(`✅ Using tenant: "${tenant.name}" (${tenant.id})`);

    // Backfill semua model secara dinamis (menggunakan Prisma DMMF)
    const modelsWithTenantId = Prisma.dmmf.datamodel.models.filter((model) =>
      model.fields.some((f) => f.name === "tenantId"),
    );

    let totalUpdated = 0;

    for (const model of modelsWithTenantId) {
      const delegateProp =
        model.name.charAt(0).toLowerCase() + model.name.slice(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delegate = (prisma as any)[delegateProp];

      if (delegate && delegate.updateMany) {
        try {
          const result = await delegate.updateMany({
            where: { tenantId: null },
            data: { tenantId: tenant.id },
          });
          if (result.count > 0) {
            console.log(`  🔹 ${model.name}: Updated ${result.count} records`);
            totalUpdated += result.count;
          }
        } catch {
          optionalFailureCount += 1;
          // Skip models yang mungkin tidak ada di environment tertentu
        }
      }
    }

    if (totalUpdated === 0) {
      console.log("  ℹ️  No orphaned records found.");
    }

    console.log(
      `✅ [migrate-legacy-tenant] Complete. Total updated: ${totalUpdated}`,
    );
  } catch (error) {
    console.error("❌ Migration Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
    if (optionalFailureCount > 0) {
      process.exitCode = 1;
    }
  }
}

main();
