/**
 * Add GENERAL_TIMEZONE setting to all active tenants
 */
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "crypto";
import "dotenv/config";
import { logger } from "../lib/logger";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

const DEFAULT_TIMEZONE = "Asia/Jakarta";

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  logger.info(`Found ${tenants.length} active tenants`);

  let created = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    const existing = await prisma.settings.findFirst({
      where: { key: "GENERAL_TIMEZONE", tenantId: tenant.id },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.settings.create({
      data: {
        id: randomUUID(),
        key: "GENERAL_TIMEZONE",
        value: DEFAULT_TIMEZONE,
        description: "Timezone aplikasi (IANA format)",
        tenantId: tenant.id,
        updatedAt: new Date(),
      },
    });
    created++;
    logger.info(
      `  ✅ Created GENERAL_TIMEZONE for tenant: ${tenant.name} (${tenant.id})`,
    );
  }

  // Also ensure global setting exists (no tenantId)
  const globalExisting = await prisma.settings.findFirst({
    where: { key: "GENERAL_TIMEZONE", tenantId: null },
  });

  if (!globalExisting) {
    await prisma.settings.create({
      data: {
        id: randomUUID(),
        key: "GENERAL_TIMEZONE",
        value: DEFAULT_TIMEZONE,
        description: "Timezone aplikasi (IANA format)",
        updatedAt: new Date(),
      },
    });
    created++;
    logger.info("  ✅ Created global GENERAL_TIMEZONE setting");
  }

  logger.info(`\n✅ Done: ${created} created, ${skipped} already existed`);
  await prisma.$disconnect();
}

main().catch((e) => {
  logger.error("Error:", e);
  process.exit(1);
});
