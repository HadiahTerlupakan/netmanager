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
import { resolveInvoiceCreatedCoa } from "./coa-resolver";

const SOURCE = "InvoiceCreatedAccountingHandler";

export async function handleInvoiceCreatedAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const invoiceId = requirePayloadString(
    payload.invoiceId,
    "invoiceId",
    SOURCE,
  );
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const totalAmount = requirePayloadString(
    payload.totalAmount,
    "totalAmount",
    SOURCE,
  );
  const createdAt = requirePayloadString(
    payload.createdAt,
    "createdAt",
    SOURCE,
  );

  logger.info(
    `[${SOURCE}] Processing invoice ${invoiceId} for tenant ${tenantId}`,
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
  const entryDate = new Date(createdAt);
  await periodService.ensureCurrentPeriod(tenantId, entryDate);

  const { debitCoaId, creditCoaId } = await resolveInvoiceCreatedCoa(tenantId);

  await postingService.postAuto(tenantId, {
    source: "AUTO_INVOICE_CREATED",
    sourceRefType: "Invoice",
    sourceRefId: invoiceId,
    entryDate,
    description: `Jurnal otomatis: Invoice ${invoiceId} dibuat (accrual)`,
    lines: [
      { coaId: debitCoaId, side: "DEBIT", amount: totalAmount },
      { coaId: creditCoaId, side: "CREDIT", amount: totalAmount },
    ],
  });

  logger.info(`[${SOURCE}] Journal posted for invoice ${invoiceId}`);
}
