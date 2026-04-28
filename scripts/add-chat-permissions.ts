import { MAIN_TENANT_ID } from "../modules/mitra/services/tenant-constants";
// Jalankan: npx tsx scripts/add-chat-permissions.ts

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

// Simple ID generator without extra deps
function generateId(): string {
  return `perm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

async function main() {
  logger.info("🔧 Adding Chat permissions...");

  const permissions = [
    {
      name: "chat:read",
      description: "Membaca pesan chat",
      resource: "chat",
      action: "read",
    },
    {
      name: "chat:create",
      description: "Mengirim pesan chat",
      resource: "chat",
      action: "create",
    },
    {
      name: "broadcast:create",
      description: "Mengirim broadcast ke semua users",
      resource: "broadcast",
      action: "create",
    },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: {
        resource_action_tenantId: {
          resource: perm.resource,
          action: perm.action,
          tenantId: MAIN_TENANT_ID,
        },
      },
      update: {
        name: perm.name,
        description: perm.description,
        updatedAt: new Date(),
      },
      create: {
        id: generateId(),
        name: perm.name,
        description: perm.description,
        resource: perm.resource,
        action: perm.action,
        updatedAt: new Date(),
      },
    });
    logger.info(`✓ ${perm.name}`);
  }

  // Assign permissions to SUPER_ADMIN role
  const superAdminRole = await prisma.role.findFirst({
    where: { name: "SUPER_ADMIN", tenantId: MAIN_TENANT_ID },
  });

  if (superAdminRole) {
    // Find the permissions we just upserted
    // Note: Can't search by name efficiently if not unique, but for this script it's practically unique
    // Better to search by resource/action again or just fetch all that match our list

    // Let's iterate and connect individually to be safe
    for (const perm of permissions) {
      const dbPerm = await prisma.permission.findFirst({
        where: {
          resource: perm.resource,
          action: perm.action,
          tenantId: MAIN_TENANT_ID,
        },
      });

      if (dbPerm) {
        await prisma.role.update({
          where: { id: superAdminRole.id },
          data: {
            permission: {
              connect: { id: dbPerm.id },
            },
          },
        });
      }
    }
    logger.info("✓ Assigned all Chat permissions to SUPER_ADMIN");
  }

  logger.info("\n✅ Chat permissions added successfully!");
  logger.info("\n📝 Menu Chat akan muncul di sidebar setelah refresh.");
  logger.info(
    "📝 Untuk role lain, assign permission via Admin Portal > Settings > Roles.",
  );
}

main()
  .catch((e) => {
    logger.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
