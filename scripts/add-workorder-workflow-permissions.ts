/**
 * Script untuk menambahkan permission cancel dan verify untuk Work Order
 *
 * Run: npx tsx scripts/add-workorder-workflow-permissions.ts
 */

import { prisma } from "../lib/prisma";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";

const createId = () => randomUUID();

async function main() {
  logger.info("🔄 Adding workflow permissions for Work Order...\n");

  const workflowPermissions = [
    {
      name: "list:cancel",
      description: "Membatalkan Work Order",
      resource: "list",
      action: "cancel",
    },
    {
      name: "list:verify",
      description: "Memverifikasi/Menolak Work Order yang sudah COMPLETED",
      resource: "list",
      action: "verify",
    },
    {
      name: "workorders:cancel",
      description: "Membatalkan Work Order (menu parent)",
      resource: "workorders",
      action: "cancel",
    },
    {
      name: "workorders:verify",
      description: "Memverifikasi/Menolak Work Order (menu parent)",
      resource: "workorders",
      action: "verify",
    },
  ];

  for (const perm of workflowPermissions) {
    // Check if permission already exists using unique compound key
    const existing = await prisma.permission.findFirst({
      where: {
        resource: perm.resource,
        action: perm.action,
      },
    });

    if (existing) {
      logger.info(`⏭️  Skip: ${perm.name} (already exists)`);
    } else {
      await prisma.permission.create({
        data: {
          id: createId(),
          name: perm.name,
          description: perm.description,
          resource: perm.resource,
          action: perm.action,
          updatedAt: new Date(),
        },
      });
      logger.info(`✅ Created: ${perm.name}`);
    }
  }

  // Assign cancel/verify permissions to SUPER_ADMIN role
  const superAdminRole = await prisma.role.findFirst({
    where: { name: "SUPER_ADMIN" },
  });

  if (superAdminRole) {
    const newPermissions = await prisma.permission.findMany({
      where: {
        OR: workflowPermissions.map((p) => ({
          resource: p.resource,
          action: p.action,
        })),
      },
    });

    // Use raw query to add permissions to role
    for (const perm of newPermissions) {
      const existing = (await prisma.$queryRaw`
        SELECT * FROM "_PermissionToRole"
        WHERE "A" = ${perm.id} AND "B" = ${superAdminRole.id}
      `) as unknown[];

      if (existing.length === 0) {
        await prisma.$executeRaw`
          INSERT INTO "_PermissionToRole" ("A", "B") 
          VALUES (${perm.id}, ${superAdminRole.id})
        `;
        logger.info(`  → Linked ${perm.name} to SUPER_ADMIN`);
      }
    }
    logger.info("\n✅ Assigned new permissions to SUPER_ADMIN role");
  }

  logger.info("\n✅ Done! New permissions added:");
  logger.info('   - list:cancel      → Untuk tombol "Batalkan"');
  logger.info('   - list:verify      → Untuk tombol "Verifikasi" dan "Tolak"');
  logger.info("   - workorders:cancel");
  logger.info("   - workorders:verify");
  logger.info(
    "\n⚠️  Catatan: User perlu logout dan login ulang agar permission baru efektif",
  );
}

main()
  .catch((e) => {
    logger.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
