import { Prisma, PrismaClient } from "@prisma/client";
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

function getDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  return connectionString;
}

function createPrismaClient() {
  const pool = new Pool({ connectionString: getDatabaseUrl() });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter, log: ["error", "warn"] });

  return { client, pool };
}

const prismaRequiredTenantModels = new Set([
  "AttendanceEvaluation",
  "AttendanceEvaluationAudit",
]);

function isTenantBackfillCandidate(model: Prisma.DMMF.Model) {
  const hasNullableTenantId = model.fields.some(
    (field) => field.name === "tenantId" && !field.isRequired,
  );

  if (!hasNullableTenantId) {
    return false;
  }

  if (prismaRequiredTenantModels.has(model.name)) {
    return false;
  }

  if (model.name === "WorkOrderAssignments" || model.name === "WorkOrders") {
    return false;
  }

  const uniqueFields = model.uniqueFields ?? [];
  return !uniqueFields.some((fields) => fields.includes("tenantId"));
}

const { client: prisma, pool } = createPrismaClient();

async function main() {
  console.log("🚀 [migrate-legacy-tenant] Checking for orphaned data...");

  let optionalFailureCount = 0;

  try {
    let tenant = await prisma.tenant.findFirst({
      where: { name: MAIN_TENANT_NAME },
    });

    if (!tenant) {
      tenant = await prisma.tenant.findFirst({
        orderBy: { createdAt: "asc" },
      });
    }

    if (!tenant) {
      console.log("⚠️ No tenant found. Skipping legacy migration.");
      return;
    }

    console.log(`✅ Using tenant: "${tenant.name}" (${tenant.id})`);

    const modelsWithTenantId = Prisma.dmmf.datamodel.models.filter(
      isTenantBackfillCandidate,
    );

    let totalUpdated = 0;

    for (const model of modelsWithTenantId) {
      const delegateProp =
        model.name.charAt(0).toLowerCase() + model.name.slice(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delegate = (prisma as any)[delegateProp];

      if (!delegate?.updateMany) {
        continue;
      }

      try {
        const result = await delegate.updateMany({
          where: { tenantId: null },
          data: { tenantId: tenant.id },
        });

        if (result.count > 0) {
          console.log(`  🔹 ${model.name}: Updated ${result.count} records`);
          totalUpdated += result.count;
        }
      } catch (error) {
        optionalFailureCount += 1;
        const message = (error as Error).message.split("\n")[0];
        console.error(`  ❌ ${model.name}: ${message}`);
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
