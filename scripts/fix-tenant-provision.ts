import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import {
  provisionTenantData,
  getTenantAdminRoleId,
} from "../modules/mitra/services/TenantProvisioningService";
import { MAIN_TENANT_ID } from "../modules/mitra/services/tenant-constants";
import { logger } from "../lib/logger";

const { client: prisma, pool } = createPrismaClient();
let optionalFailureCount = 0;

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
  const client = new PrismaClient({ adapter, log: ["error", "warn"] });

  return { client, pool };
}

async function main() {
  logger.info("🔧 Fixing tenant provisioning for existing tenants...\n");

  const tenants = await prisma.tenant.findMany({
    where: { id: { not: MAIN_TENANT_ID } },
  });

  logger.info(`Found ${tenants.length} non-main tenant(s):\n`);

  for (const tenant of tenants) {
    logger.info(`\n━━━ Tenant: ${tenant.name} (${tenant.id}) ━━━`);

    const existingRoles = await prisma.role.count({
      where: { tenantId: tenant.id },
    });

    if (existingRoles > 0) {
      logger.info(
        `  ⚠️  Already has ${existingRoles} roles, skipping provisioning.`,
      );
    } else {
      logger.info("  📦 Provisioning data...");
      const result = await provisionTenantData(prisma, tenant.id);
      logger.info(
        `  ✅ Created: ${result.rolesCreated} roles, ${result.permissionsCreated} permissions, ${result.settingsCreated} settings`,
      );
    }

    const usersInTenant = await prisma.user.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, roleId: true },
    });

    for (const user of usersInTenant) {
      if (!user.roleId) continue;

      const userRole = await prisma.role.findUnique({
        where: { id: user.roleId },
        select: { id: true, name: true, tenantId: true },
      });

      if (userRole && userRole.tenantId !== tenant.id) {
        logger.info(
          `  🔄 User "${user.name}" points to role "${userRole.name}" from tenant ${userRole.tenantId}`,
        );

        const correctRole = await prisma.role.findFirst({
          where: { name: userRole.name, tenantId: tenant.id },
          select: { id: true },
        });

        if (correctRole) {
          await prisma.user.update({
            where: { id: user.id },
            data: { roleId: correctRole.id },
          });
          logger.info(
            `  ✅ Re-assigned to correct tenant role (${correctRole.id})`,
          );
          continue;
        }

        const adminRoleId = await getTenantAdminRoleId(prisma, tenant.id);
        if (adminRoleId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { roleId: adminRoleId },
          });
          logger.info(
            `  ✅ Assigned to admin role (${adminRoleId}) as fallback`,
          );
          continue;
        }

        optionalFailureCount += 1;
        logger.info(`  ❌ No suitable role found for user "${user.name}"`);
      }
    }
  }

  logger.info("\n✅ Done!");
}

main()
  .catch((error) => {
    logger.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();

    if (optionalFailureCount > 0) {
      process.exitCode = 1;
    }
  });
