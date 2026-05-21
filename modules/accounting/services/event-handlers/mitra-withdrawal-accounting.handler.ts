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
import { resolveMitraWithdrawalCoa } from "./coa-resolver";
import { CoaNotFoundError } from "../../errors";

const SOURCE = "MitraWithdrawalAccountingHandler";

/** Membuat jurnal otomatis saat pencairan dana mitra selesai. */
export async function handleMitraWithdrawalAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const withdrawalId = requirePayloadString(
    payload.withdrawalId,
    "withdrawalId",
    SOURCE,
  );
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const amount = requirePayloadString(payload.amount, "amount", SOURCE);
  const completedAt = requirePayloadString(
    payload.completedAt,
    "completedAt",
    SOURCE,
  );

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
    const entryDate = new Date(completedAt);
    await periodService.ensureCurrentPeriod(tenantId, entryDate);

    const { debitCoaId, creditCoaId } =
      await resolveMitraWithdrawalCoa(tenantId);

    await postingService.postAuto(tenantId, {
      source: "AUTO_MITRA_WITHDRAWAL",
      sourceRefType: "MitraWithdrawal",
      sourceRefId: withdrawalId,
      entryDate,
      description: `Jurnal otomatis: pencairan dana mitra ${withdrawalId}`,
      lines: [
        { coaId: debitCoaId, side: "DEBIT", amount },
        { coaId: creditCoaId, side: "CREDIT", amount },
      ],
    });

    logger.info(
      `[${SOURCE}] Journal posted for mitra withdrawal ${withdrawalId}`,
    );
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
