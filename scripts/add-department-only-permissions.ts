/**
 * Add Department Only Permission Script
 * Menambahkan permission department_only untuk resources yang memerlukannya
 *
 * Jalankan: npx tsx scripts/add-department-only-permissions.ts
 */

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

// Generate simple ID
function generateId(): string {
  return `perm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Resources yang perlu department_only tapi belum punya
const RESOURCES_NEED_DEPT_ONLY = [
  "dashboard", // Dashboard perlu filter data per department
  "work_order_dashboard", // Sudah ada? akan dicek dulu
  "report", // Laporan kehadiran perlu filter department
  "daily_income", // Finance perlu filter department jika ada
  "period_income",
  "profit_loss",
  "system_log", // Log perlu filter department jika relevan
];

async function main() {
  logger.info("🔧 Add Department Only Permissions");
  logger.info("===================================");
  logger.info("");

  for (const resource of RESOURCES_NEED_DEPT_ONLY) {
    // Check if department_only already exists for this resource
    const existing = await prisma.permission.findFirst({
      where: { resource, action: "department_only" },
    });

    if (existing) {
      logger.info(`✓ ${resource}:department_only - sudah ada`);
      continue;
    }

    // Create new permission with all required fields
    const newPerm = await prisma.permission.create({
      data: {
        id: generateId(),
        name: `${resource}:department_only`,
        resource,
        action: "department_only",
        description: `Restricts ${resource} access to user's department only`,
        updatedAt: new Date(),
      },
    });
    logger.info(`+ ${resource}:department_only - ditambahkan (${newPerm.id})`);
  }

  logger.info("");
  logger.info("✅ Selesai!");
}

main()
  .catch(logger.error)
  .finally(() => prisma.$disconnect());
