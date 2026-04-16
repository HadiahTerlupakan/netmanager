process.env.IS_SEEDING = "true";
import { Prisma } from "@prisma/client";
import { prismaAuth as prisma } from "../lib/prisma";
import {
  MAIN_TENANT_NAME,
  MAIN_TENANT_ID,
} from "../modules/mitra/services/tenant-constants";

let optionalFailureCount = 0;

/**
 * Script ini bersifat IDEMPOTENT.
 *
 * Logika sederhana:
 * 1. Jika sudah ada tenant bernama NETMANAGER → pakai itu
 * 2. Jika belum, cari tenant apapun yang ada (Main Tenant, Radpro Network, dll) → rename ke NETMANAGER
 * 3. Jika tidak ada tenant sama sekali → buat baru
 * 4. Backfill semua record yang tenantId-nya null
 *
 * TIDAK mengubah primary key atau memindahkan data antar tenant.
 */

async function main() {
  console.log("=============================================");
  console.log("🏗️  MULTI-TENANT DATA BACKFILL SCRIPT");
  console.log("=============================================");
  console.log(`Target Tenant Name: "${MAIN_TENANT_NAME}"\n`);

  // 1. Cari tenant dengan nama yang benar
  let tenant = await prisma.tenant.findFirst({
    where: { name: MAIN_TENANT_NAME },
  });

  if (tenant) {
    console.log(`✅ Tenant "${MAIN_TENANT_NAME}" sudah ada (ID: ${tenant.id})`);
  } else {
    // 2. Cari tenant apapun yang sudah ada (legacy names)
    const existingTenant = await prisma.tenant.findFirst({
      orderBy: { createdAt: "asc" }, // Ambil yang paling lama (tenant asli)
    });

    if (existingTenant) {
      // Rename tenant yang ada ke NETMANAGER
      console.log(
        `🔄 Renaming tenant "${existingTenant.name}" → "${MAIN_TENANT_NAME}"`,
      );
      tenant = await prisma.tenant.update({
        where: { id: existingTenant.id },
        data: { name: MAIN_TENANT_NAME },
      });
      console.log(`✅ Tenant renamed successfully (ID: ${tenant.id})`);
    } else {
      // 3. Tidak ada tenant sama sekali → buat baru
      tenant = await prisma.tenant.create({
        data: {
          id: MAIN_TENANT_ID,
          name: MAIN_TENANT_NAME,
        },
      });
      console.log(
        `✨ Created new tenant: "${MAIN_TENANT_NAME}" (ID: ${tenant.id})`,
      );
    }
  }

  // 4. Backfill semua record yang tenantId-nya null
  const modelsWithTenantId = Prisma.dmmf.datamodel.models.filter((model) =>
    model.fields.some((f) => f.name === "tenantId"),
  );

  console.log(
    `\n🔍 Found ${modelsWithTenantId.length} tables with tenantId field.`,
  );
  console.log("⚙️  Backfilling orphaned records (tenantId = null)...\n");

  let totalUpdated = 0;
  let tablesAffected = 0;

  for (const model of modelsWithTenantId) {
    const modelName = model.name;
    const delegateProp = modelName.charAt(0).toLowerCase() + modelName.slice(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[delegateProp];

    if (delegate && delegate.updateMany) {
      try {
        const result = await delegate.updateMany({
          where: { tenantId: null },
          data: { tenantId: tenant.id },
        });

        if (result.count > 0) {
          console.log(
            `✅ [${modelName.padEnd(25)}] Updated ${result.count} orphaned records`,
          );
          totalUpdated += result.count;
          tablesAffected++;
        }
      } catch (e) {
        const err = e as Error;
        optionalFailureCount += 1;
        console.error(
          `❌ [${modelName.padEnd(25)}] Failed: ${err.message.split("\n")[0]}`,
        );
      }
    }
  }

  console.log("\n=============================================");
  console.log("🎉 BACKFILL COMPLETE!");
  console.log("=============================================");
  console.log(`📊 Tables updated  : ${tablesAffected}`);
  console.log(`📊 Rows updated    : ${totalUpdated}`);
  console.log(`🔑 Tenant ID       : ${tenant.id}`);
  console.log(`🏢 Tenant Name     : ${tenant.name}`);
  console.log("=============================================");
}

main()
  .catch((e) => {
    console.error("Fatal Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (optionalFailureCount > 0) {
      process.exitCode = 1;
    }
  });
