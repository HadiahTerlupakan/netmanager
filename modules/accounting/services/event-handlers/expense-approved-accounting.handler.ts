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
import { resolveExpenseApprovedCoa } from "./coa-resolver";
import { CoaNotFoundError } from "../../errors";

const SOURCE = "ExpenseApprovedAccountingHandler";

export async function handleExpenseApprovedAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const expenseId = requirePayloadString(
    payload.expenseId,
    "expenseId",
    SOURCE,
  );
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const amount = requirePayloadString(payload.amount, "amount", SOURCE);
  const accountId = requirePayloadString(
    payload.accountId,
    "accountId",
    SOURCE,
  );
  const expenseCategoryId = requirePayloadString(
    payload.expenseCategoryId,
    "expenseCategoryId",
    SOURCE,
  );
  const expenseDate = requirePayloadString(
    payload.expenseDate,
    "expenseDate",
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
    const entryDate = new Date(expenseDate);
    await periodService.ensureCurrentPeriod(tenantId, entryDate);

    const { debitCoaId, creditCoaId } = await resolveExpenseApprovedCoa(
      tenantId,
      expenseCategoryId,
      accountId,
    );

    await postingService.postAuto(tenantId, {
      source: "AUTO_EXPENSE",
      sourceRefType: "Expense",
      sourceRefId: expenseId,
      entryDate,
      description: `Jurnal otomatis: Expense ${expenseId} disetujui`,
      lines: [
        { coaId: debitCoaId, side: "DEBIT", amount },
        { coaId: creditCoaId, side: "CREDIT", amount },
      ],
    });

    logger.info(`[${SOURCE}] Journal posted for expense ${expenseId}`);
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
