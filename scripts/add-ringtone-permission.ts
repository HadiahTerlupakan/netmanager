import { MAIN_TENANT_ID } from "../modules/mitra/services/tenant-constants";

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

function generateId(): string {
  return `perm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

async function main() {
  logger.info("Adding NADA_DERING permissions...");

  const perm = {
    name: "nada_dering:read",
    description: "Membaca pengaturan nada dering",
    resource: "nada_dering",
    action: "read",
  };

  try {
    // Upsert permission
    // Using compound unique key pattern from existing codebase
    const permission = await prisma.permission.upsert({
      where: {
        resource_action_tenantId: {
          resource: perm.resource,
          action: perm.action,
          tenantId: MAIN_TENANT_ID,
        },
      },
      update: {},
      create: {
        id: generateId(),
        name: perm.name,
        description: perm.description,
        resource: perm.resource,
        action: perm.action,
        updatedAt: new Date(),
      },
    });
    logger.info(`Permission ensured: ${permission.id}`);

    // Assign to Super Admin
    const superAdminRole = await prisma.role.findFirst({
      where: { name: "SUPER_ADMIN", tenantId: MAIN_TENANT_ID },
    });

    if (superAdminRole) {
      logger.info(
        `Assigning to Role: ${superAdminRole.name} (ID: ${superAdminRole.id})`,
      );

      // Try connecting
      await prisma.role.update({
        where: { id: superAdminRole.id },
        data: {
          permission: {
            connect: { id: permission.id },
          },
        },
      });
      logger.info(`Assigned permission to SUPER_ADMIN`);
    }
  } catch (e: unknown) {
    const error = e as Error;
    logger.error("Error in script:", error);
    // Check if error is due to field name mismatch (permissions vs permission)
    if (error.message?.includes("Unknown arg")) {
      logger.info("Retrying with different relation field name...");
      const superAdminRole = await prisma.role.findFirst({
        where: { name: "SUPER_ADMIN", tenantId: MAIN_TENANT_ID },
      });
      if (superAdminRole) {
        await prisma.role.update({
          where: { id: superAdminRole.id },
          data: {
            permission: {
              connect: {
                id: (
                  await prisma.permission.findFirst({
                    where: {
                      resource: "nada_dering",
                      action: "read",
                      tenantId: MAIN_TENANT_ID,
                    },
                  })
                )?.id,
              },
            },
          },
        });
        logger.info(`Assigned permission to SUPER_ADMIN (fallback)`);
      }
    }
  }
}

main()
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
