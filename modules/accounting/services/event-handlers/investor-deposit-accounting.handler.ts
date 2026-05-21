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
import { resolveInvestorDepositCoa } from "./coa-resolver";
import { CoaNotFoundError } from "../../errors";

const SOURCE = "InvestorDepositAccountingHandler";

/**
 * Membuat jurnal otomatis saat deposit investor selesai (COMPLETED).
 *
 * Jika depositType === "MODAL_AWAL" atau "TAMBAHAN_MODAL":
 *   DR Kas/Bank (1-120) / CR Modal Investor (3-100)
 *
 * Jika depositType === "PINJAMAN":
 *   DR Kas/Bank (1-120) / CR Hutang Investor (2-600)
 */
export async function handleInvestorDepositAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const depositId = requirePayloadString(
    payload.depositId,
    "depositId",
    SOURCE,
  );
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const amount = requirePayloadString(payload.amount, "amount", SOURCE);
  const depositType = requirePayloadString(
    payload.depositType,
    "depositType",
    SOURCE,
  );
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

    const { debitCoaId, creditCoaId } = await resolveInvestorDepositCoa(
      tenantId,
      depositType,
    );

    const description =
      depositType === "PINJAMAN"
        ? `Jurnal otomatis: pinjaman investor ${depositId}`
        : `Jurnal otomatis: setoran modal investor ${depositId}`;

    await postingService.postAuto(tenantId, {
      source: "AUTO_INVESTOR_DEPOSIT",
      sourceRefType: "InvestorDeposit",
      sourceRefId: depositId,
      entryDate,
      description,
      lines: [
        { coaId: debitCoaId, side: "DEBIT", amount },
        { coaId: creditCoaId, side: "CREDIT", amount },
      ],
    });

    logger.info(
      `[${SOURCE}] Journal posted for investor deposit ${depositId} (${depositType})`,
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
