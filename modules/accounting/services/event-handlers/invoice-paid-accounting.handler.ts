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
import { resolveInvoicePaidCoa } from "./coa-resolver";

const SOURCE = "InvoicePaidAccountingHandler";

export async function handleInvoicePaidAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const invoiceId = requirePayloadString(
    payload.invoiceId,
    "invoiceId",
    SOURCE,
  );
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const amount = requirePayloadString(payload.amount, "amount", SOURCE);
  const accountId = requirePayloadString(
    payload.accountId,
    "accountId",
    SOURCE,
  );
  const paidAt = requirePayloadString(payload.paidAt, "paidAt", SOURCE);

  logger.info(
    `[${SOURCE}] Processing invoice paid ${invoiceId} for tenant ${tenantId}`,
  );

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
  const entryDate = new Date(paidAt);
  await periodService.ensureCurrentPeriod(tenantId, entryDate);

  const { debitCoaId, creditCoaId } = await resolveInvoicePaidCoa(
    tenantId,
    accountId,
  );

  await postingService.postAuto(tenantId, {
    source: "AUTO_INVOICE_PAID",
    sourceRefType: "Invoice",
    sourceRefId: invoiceId,
    entryDate,
    description: `Jurnal otomatis: Invoice ${invoiceId} dibayar`,
    lines: [
      { coaId: debitCoaId, side: "DEBIT", amount },
      { coaId: creditCoaId, side: "CREDIT", amount },
    ],
  });

  logger.info(`[${SOURCE}] Journal posted for invoice paid ${invoiceId}`);
}
