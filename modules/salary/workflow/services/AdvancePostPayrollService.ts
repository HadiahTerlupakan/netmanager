import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * After payroll run transitions to PAID, update salary advance balances.
 *
 * Idempotency:
 *   PayrollRun.advancesProcessedAt di-set di akhir transaksi.
 *   Jika sudah set, function early-return — mencegah double-deduction
 *   bila PAID dipanggil 2x atau retry setelah crash.
 *
 * Atomicity:
 *   Seluruh update (advance balances + run marker) jalan dalam satu
 *   prisma.$transaction agar konsisten end-to-end.
 *
 * Konsumsi:
 *   Lines payroll dengan componentCode `ADVANCE_<advanceId>` dianggap
 *   pengembalian kasbon. Mengurangi remainingAmount di SalaryAdvance.
 *   Mark DEDUCTED jika remainingAmount habis.
 */
export async function processAdvanceDeductions(
  runId: string,
  tenantId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const run = await tx.payrollRun.findFirst({
      where: { id: runId, tenantId },
      select: { id: true, advancesProcessedAt: true },
    });

    if (!run) {
      logger.warn(
        `[AdvancePostPayroll] PayrollRun ${runId} tidak ditemukan di tenant ${tenantId}`,
      );
      return;
    }

    if (run.advancesProcessedAt) {
      logger.info(
        `[AdvancePostPayroll] Run ${runId} sudah di-process pada ${run.advancesProcessedAt.toISOString()}, skipping`,
      );
      return;
    }

    const lines = await tx.payrollLine.findMany({
      where: {
        entry: { payrollRunId: runId, tenantId },
        componentCode: { startsWith: "ADVANCE_" },
      },
      select: { componentCode: true, amount: true },
    });

    for (const line of lines) {
      const advanceId = line.componentCode.replace("ADVANCE_", "");

      const advance = await tx.salaryAdvance.findFirst({
        where: { id: advanceId, tenantId },
        select: { id: true, status: true, remainingAmount: true },
      });

      if (!advance) continue;
      if (advance.status !== "DISBURSED") continue;

      const newRemaining = Math.max(0, advance.remainingAmount - line.amount);

      if (newRemaining === 0) {
        await tx.salaryAdvance.update({
          where: { id: advanceId },
          data: { remainingAmount: 0, status: "DEDUCTED" },
        });
        logger.info(
          `[AdvancePostPayroll] Advance ${advanceId} fully deducted, marked DEDUCTED`,
        );
      } else {
        await tx.salaryAdvance.update({
          where: { id: advanceId },
          data: { remainingAmount: newRemaining },
        });
        logger.info(
          `[AdvancePostPayroll] Advance ${advanceId} partially deducted, remaining: ${newRemaining}`,
        );
      }
    }

    await tx.payrollRun.update({
      where: { id: runId },
      data: { advancesProcessedAt: new Date() },
    });
  });
}
