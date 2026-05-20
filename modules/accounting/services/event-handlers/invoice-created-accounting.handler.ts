import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { prismaBilling } from "@/lib/prisma-billing";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { JournalPostingService } from "../journal/JournalPostingService";
import { JournalNumberGenerator } from "../journal/JournalNumberGenerator";
import { JournalRepository } from "../../repositories/JournalRepository";
import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { PeriodRepository } from "../../repositories/PeriodRepository";
import { PeriodService } from "../period/PeriodService";
import { resolveInvoiceCreatedCoa } from "./coa-resolver";
import { CoaNotFoundError } from "../../errors";

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

  const invoice = await prismaBilling.invoice.findUnique({
    where: { id: invoiceId },
    select: { tenantId: true, totalAmount: true, createdAt: true },
  });
  if (!invoice || !invoice.tenantId) {
    logger.warn(
      `[${SOURCE}] Invoice ${invoiceId} not found or no tenantId, skipping`,
    );
    return;
  }

  const tenantId = invoice.tenantId;
  const totalAmount = (payload.amount ?? invoice.totalAmount).toString();
  const createdAt = payload.createdAt ?? invoice.createdAt.toISOString();

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
    const entryDate = new Date(createdAt);
    await periodService.ensureCurrentPeriod(tenantId, entryDate);

    const { debitCoaId, creditCoaId } =
      await resolveInvoiceCreatedCoa(tenantId);

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
