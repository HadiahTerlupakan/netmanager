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

  const invoice = await prismaBilling.invoice.findUnique({
    where: { id: invoiceId },
    select: { tenantId: true, totalAmount: true },
  });
  if (!invoice || !invoice.tenantId) {
    logger.warn(
      `[${SOURCE}] Invoice ${invoiceId} not found or no tenantId, skipping`,
    );
    return;
  }

  const lastPayment = await prismaBilling.payment.findFirst({
    where: { invoiceId },
    orderBy: { paymentDate: "desc" },
    select: { accountId: true },
  });

  const tenantId = invoice.tenantId;
  const amount = (payload.amount ?? invoice.totalAmount).toString();
  const accountId = payload.accountId ?? lastPayment?.accountId ?? "";
  const paidAt = payload.paidAt ?? new Date().toISOString();

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
