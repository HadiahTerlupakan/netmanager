process.env.IS_SEEDING = "true";
import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import {
  MAIN_TENANT_ID,
  MAIN_TENANT_NAME,
} from "../modules/mitra/services/tenant-constants";

const { client: prisma, pool } = createPrismaClient();
let optionalFailureCount = 0;

type TenantRecord = {
  id: string;
  name: string;
};

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return databaseUrl;
}

function createPrismaClient() {
  const pool = new Pool({ connectionString: getDatabaseUrl() });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

  return { client, pool };
}

function isTenantBackfillCandidate(model: Prisma.DMMF.Model) {
  const hasNullableTenantId = model.fields.some(
    (field) => field.name === "tenantId" && !field.isRequired,
  );

  if (!hasNullableTenantId) {
    return false;
  }

  const uniqueFields = model.uniqueFields ?? [];
  return !uniqueFields.some((fields) => fields.includes("tenantId"));
}

function getTenantBackfillModels() {
  return Prisma.dmmf.datamodel.models.filter(isTenantBackfillCandidate);
}

async function createMainTenant() {
  const tenant = await prisma.tenant.create({
    data: {
      id: MAIN_TENANT_ID,
      name: MAIN_TENANT_NAME,
    },
  });

  console.log(
    `✨ Created new tenant: "${MAIN_TENANT_NAME}" (ID: ${tenant.id})`,
  );
  return tenant;
}

async function findOrCreateMainTenant(): Promise<TenantRecord> {
  const currentTenant = await prisma.tenant.findFirst({
    where: { name: MAIN_TENANT_NAME },
  });

  if (currentTenant) {
    console.log(
      `✅ Tenant "${MAIN_TENANT_NAME}" sudah ada (ID: ${currentTenant.id})`,
    );
    return currentTenant;
  }

  const oldestTenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!oldestTenant) {
    return createMainTenant();
  }

  console.log(
    `🔄 Renaming tenant "${oldestTenant.name}" → "${MAIN_TENANT_NAME}"`,
  );
  const renamedTenant = await prisma.tenant.update({
    where: { id: oldestTenant.id },
    data: { name: MAIN_TENANT_NAME },
  });

  console.log(`✅ Tenant renamed successfully (ID: ${renamedTenant.id})`);
  return renamedTenant;
}

async function backfillModel(
  model: Prisma.DMMF.Model,
  tenantId: string,
): Promise<number> {
  const modelName = model.name;
  const delegateProp = modelName.charAt(0).toLowerCase() + modelName.slice(1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as any)[delegateProp];
  if (!delegate?.updateMany) {
    return 0;
  }

  try {
    const result = await delegate.updateMany({
      where: { tenantId: null },
      data: { tenantId },
    });

    if (result.count > 0) {
      console.log(
        `✅ [${modelName.padEnd(25)}] Updated ${result.count} orphaned records`,
      );
    }

    return result.count;
  } catch (error) {
    const message = (error as Error).message.split("\n")[0];
    optionalFailureCount += 1;
    console.error(`❌ [${modelName.padEnd(25)}] Failed: ${message}`);
    return 0;
  }
}

async function backfillTenantRecords(tenantId: string) {
  const models = getTenantBackfillModels();
  let totalUpdated = 0;
  let tablesAffected = 0;

  console.log(
    `\n🔍 Found ${models.length} safe tables with nullable tenantId.`,
  );
  console.log("⚙️  Backfilling orphaned records (tenantId = null)...\n");

  for (const model of models) {
    const updatedCount = await backfillModel(model, tenantId);

    if (updatedCount === 0) {
      continue;
    }

    totalUpdated += updatedCount;
    tablesAffected += 1;
  }

  return { totalUpdated, tablesAffected };
}

function logSummary(summary: {
  tenant: TenantRecord;
  totalUpdated: number;
  tablesAffected: number;
}) {
  console.log("\n=============================================");
  console.log("🎉 BACKFILL COMPLETE!");
  console.log("=============================================");
  console.log(`📊 Tables updated  : ${summary.tablesAffected}`);
  console.log(`📊 Rows updated    : ${summary.totalUpdated}`);
  console.log(`🔑 Tenant ID       : ${summary.tenant.id}`);
  console.log(`🏢 Tenant Name     : ${summary.tenant.name}`);
  console.log("=============================================");
}

async function main() {
  console.log("=============================================");
  console.log("🏗️  MULTI-TENANT DATA BACKFILL SCRIPT");
  console.log("=============================================");
  console.log(`Target Tenant Name: "${MAIN_TENANT_NAME}"\n`);

  const tenant = await findOrCreateMainTenant();
  const summary = await backfillTenantRecords(tenant.id);

  logSummary({ tenant, ...summary });
}

main()
  .catch((error) => {
    console.error("Fatal Error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();

    if (optionalFailureCount > 0) {
      process.exitCode = 1;
    }
  });
