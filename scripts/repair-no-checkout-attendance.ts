import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { getTimezone } from "@/lib/utils/get-timezone";
import { NoCheckoutRepairService } from "@/modules/attendance/services/NoCheckoutRepairService";
import { logger } from "@/lib/logger";

import {
  parseRepairArgs,
  resolveRepairTenantIds,
  runRepairTenantContext,
  type RepairArgs,
} from "./repair-no-checkout-attendance-args";

const ACTOR_ID = "repair-no-checkout-attendance-script";

type TenantRepairArgs = Omit<RepairArgs, "tenantId" | "allTenants"> & {
  tenantId: string;
};

async function findNoCheckoutRecords(args: TenantRepairArgs) {
  return prisma.attendance.findMany({
    where: {
      tenantId: args.tenantId,
      status: "NO_CHECKOUT",
      correctedAt: null,
      checkIn: { gte: args.startDate, lte: args.endDate },
    },
    select: {
      id: true,
      userId: true,
      checkIn: true,
      checkOut: true,
      checkOutPhoto: true,
      checkOutLocation: true,
      notes: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { checkIn: "asc" },
  });
}

function hasCheckoutEvidence(record: {
  checkOut: Date | null;
  checkOutPhoto: string | null;
  checkOutLocation: string | null;
}) {
  return Boolean(
    record.checkOut && (record.checkOutPhoto || record.checkOutLocation),
  );
}

async function logCandidates(args: TenantRepairArgs) {
  const records = await findNoCheckoutRecords(args);
  const safeCandidates = records.filter(hasCheckoutEvidence);
  const autoCheckoutOnlyRecords = records.filter(
    (record) => !hasCheckoutEvidence(record) && args.includeAutoCheckoutOnly,
  );
  const manualReviewRecords = records.filter(
    (record) => !hasCheckoutEvidence(record) && !args.includeAutoCheckoutOnly,
  );

  logger.info(`Kandidat aman ditemukan: ${safeCandidates.length}`);
  for (const candidate of safeCandidates) {
    logger.info(formatRecord(candidate));
  }

  logger.info(
    `Kandidat incident auto-checkout-only: ${autoCheckoutOnlyRecords.length}`,
  );
  for (const record of autoCheckoutOnlyRecords) {
    logger.info(formatRecord(record));
  }

  logger.info(`Butuh review manual: ${manualReviewRecords.length}`);
  for (const record of manualReviewRecords) {
    logger.info(formatRecord(record));
  }
}

function formatRecord(record: {
  id: string;
  userId: string;
  checkIn: Date;
  checkOut: Date | null;
  checkOutPhoto: string | null;
  checkOutLocation: string | null;
  notes: string | null;
  user: { name: string | null; email: string | null } | null;
}) {
  return [
    record.id,
    record.user?.name ?? record.userId,
    record.user?.email ?? "-",
    record.checkIn.toISOString(),
    record.checkOut?.toISOString() ?? "checkout=NULL",
    record.checkOutPhoto ? "photo=yes" : "photo=no",
    record.checkOutLocation ? "location=yes" : "location=no",
    record.notes ?? "-",
  ].join(" | ");
}

async function repairTenant(args: TenantRepairArgs) {
  const timezone = await getTimezone(args.tenantId);
  const service = new NoCheckoutRepairService();

  logger.info("=== REPAIR NO_CHECKOUT ATTENDANCE ===");
  logger.info(`Tenant  : ${args.tenantId}`);
  logger.info(
    `Range   : ${args.startDate.toISOString()} - ${args.endDate.toISOString()}`,
  );
  logger.info(`Mode    : ${args.dryRun ? "DRY-RUN" : "APPLY"}`);

  await logCandidates(args);

  const summary = await service.repair({
    tenantId: args.tenantId,
    startDate: args.startDate,
    endDate: args.endDate,
    dryRun: args.dryRun,
    actorId: ACTOR_ID,
    timezone,
    includeAutoCheckoutOnly: args.includeAutoCheckoutOnly,
  });

  logger.info("=== SUMMARY ===");
  logger.info(`Scanned    : ${summary.scanned}`);
  logger.info(`Repairable : ${summary.repairable}`);
  logger.info(`Repaired   : ${summary.repaired}`);

  return summary;
}

async function main() {
  const args = parseRepairArgs();
  const tenantIds = await resolveRepairTenantIds(args);

  logger.info(`Tenant diproses: ${tenantIds.length}`);

  for (const tenantId of tenantIds) {
    await runRepairTenantContext(tenantId, () =>
      repairTenant({ ...args, tenantId }),
    );
  }

  if (args.dryRun) {
    logger.info(
      "Tidak ada data diubah. Tambahkan --apply untuk menjalankan repair.",
    );
  }
}

main()
  .catch((error) => {
    logger.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
