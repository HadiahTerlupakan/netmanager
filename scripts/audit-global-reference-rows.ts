/**
 * Audit Role/Departments/Sites rows yang ber-tenantId NULL.
 *
 * Why: Prisma extension memperlakukan model-model ini sebagai
 * GLOBAL_REFERENCE_MODELS — read query pakai `OR: [{ tenantId }, { tenantId: null }]`
 * sehingga row bertenantId-null kelihatan oleh semua tenant. Ini disengaja
 * untuk role/departemen/site default dari sistem, tapi kalau ada row global
 * yang dibuat tidak sengaja oleh tenant biasa, itu data leak.
 *
 * Audit ini melaporkan:
 *   1. Berapa banyak row global per model.
 *   2. Sample 10 row terakhir (id + name + createdAt + createdBy jika ada).
 *
 * Cara pakai:
 *   IS_SEEDING=true npx tsx scripts/audit-global-reference-rows.ts
 *
 * Disarankan jadwalkan rutin (mingguan) dan kirim hasilnya ke channel
 * monitoring untuk deteksi anomali.
 */

process.env.IS_SEEDING = "true";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

import { logger } from "../lib/logger";

const SAMPLE_LIMIT = 10;

interface AuditResult {
  model: string;
  globalCount: number;
  sample: Array<Record<string, unknown>>;
}

async function auditModel(
  modelName: string,
  query: () => Promise<{
    count: number;
    rows: Array<Record<string, unknown>>;
  }>,
): Promise<AuditResult> {
  const { count, rows } = await query();
  return { model: modelName, globalCount: count, sample: rows };
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const roleAudit = await auditModel("Role", async () => {
      const [count, rows] = await Promise.all([
        prisma.role.count({ where: { tenantId: null } }),
        prisma.role.findMany({
          where: { tenantId: null },
          select: { id: true, name: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: SAMPLE_LIMIT,
        }),
      ]);
      return { count, rows };
    });

    const deptAudit = await auditModel("Departments", async () => {
      const [count, rows] = await Promise.all([
        prisma.departments.count({ where: { tenantId: null } }),
        prisma.departments.findMany({
          where: { tenantId: null },
          select: { id: true, name: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: SAMPLE_LIMIT,
        }),
      ]);
      return { count, rows };
    });

    const siteAudit = await auditModel("Sites", async () => {
      const [count, rows] = await Promise.all([
        prisma.sites.count({ where: { tenantId: null } }),
        prisma.sites.findMany({
          where: { tenantId: null },
          select: { id: true, name: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: SAMPLE_LIMIT,
        }),
      ]);
      return { count, rows };
    });

    const results: AuditResult[] = [roleAudit, deptAudit, siteAudit];
    logger.info("=== Global Reference Rows Audit ===");
    for (const result of results) {
      logger.info(`[${result.model}] global rows: ${result.globalCount}`);
      for (const row of result.sample) {
        logger.info(`  - ${JSON.stringify(row)}`);
      }
    }

    const total = results.reduce((sum, r) => sum + r.globalCount, 0);
    logger.info(`=== Total global rows: ${total} ===`);

    if (total === 0) {
      logger.info("No global reference rows detected. OK.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  logger.error("[audit-global-reference-rows] failed:", err);
  process.exitCode = 1;
});
