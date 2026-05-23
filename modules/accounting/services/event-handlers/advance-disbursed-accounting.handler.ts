import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { JournalPostingService } from "../journal/JournalPostingService";
import { JournalNumberGenerator } from "../journal/JournalNumberGenerator";
import { JournalRepository } from "../../repositories/JournalRepository";
import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { PeriodRepository } from "../../repositories/PeriodRepository";
import { PeriodService } from "../period/PeriodService";
import { resolveAdvanceDisbursedCoa } from "./coa-resolver";
import { CoaNotFoundError } from "../../errors";

const SOURCE = "AdvanceDisbursedAccountingHandler";

/**
 * Handles SALARY_ADVANCE_DISBURSED event to create disbursement journal.
 *
 * Konsep bisnis:
 *   DR Piutang Karyawan (1-150) = amount (perusahaan punya piutang ke karyawan)
 *   CR Kas/Bank                  = amount (kas keluar untuk pencairan)
 */
export async function handleAdvanceDisbursedAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const advanceId = requirePayloadString(
    payload.advanceId,
    "advanceId",
    SOURCE,
  );
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const amount = requirePayloadString(payload.amount, "amount", SOURCE);
  const disbursedAt = requirePayloadString(
    payload.disbursedAt,
    "disbursedAt",
    SOURCE,
  );
  const accountId = payload.accountId as string | undefined;

  const amountNum = Number(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    logger.warn(
      `[${SOURCE}] Invalid amount "${amount}" for advance ${advanceId}, skipping`,
    );
    return;
  }

  try {
    const journalRepo = new JournalRepository();
    const coaRepo = new ChartOfAccountRepository();
    const periodRepo = new PeriodRepository();
    const numberGen = new JournalNumberGenerator(journalRepo);
    const postingService = new JournalPostingService(
      journalRepo,
      coaRepo,
      periodRepo,
      numberGen,
    );

    const periodService = new PeriodService(periodRepo);
    const entryDate = new Date(disbursedAt);
    await periodService.ensureCurrentPeriod(tenantId, entryDate);

    const { piutangKaryawanCoaId, kasCoaId } = await resolveAdvanceDisbursedCoa(
      tenantId,
      accountId,
    );

    await postingService.postAuto(tenantId, {
      source: "AUTO_SALARY_ADVANCE",
      sourceRefType: "SalaryAdvance",
      sourceRefId: advanceId,
      entryDate,
      description: `Jurnal otomatis: Pencairan kasbon karyawan (advance ${advanceId})`,
      lines: [
        {
          coaId: piutangKaryawanCoaId,
          side: "DEBIT",
          amount: String(amountNum),
        },
        { coaId: kasCoaId, side: "CREDIT", amount: String(amountNum) },
      ],
    });

    logger.info(`[${SOURCE}] Journal posted for advance ${advanceId}`);
  } catch (error) {
    if (error instanceof CoaNotFoundError) {
      logger.warn(
        `[${SOURCE}] COA belum di-seed untuk tenant ${tenantId}, skipping: ${error.message}`,
      );
      return;
    }
    throw error;
  }
}
