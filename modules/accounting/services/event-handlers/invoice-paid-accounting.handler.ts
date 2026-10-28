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
import { resolveInvoiceReceiptCoa } from "./coa-resolver";
import { buildInvoicePaidLines } from "./invoice-paid-lines";
import { invoiceReceiptRef } from "../journal/invoice-receipt-reversal";
import { CoaNotFoundError } from "../../errors";

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
    select: { tenantId: true, invoiceNumber: true },
  });
  if (!invoice || !invoice.tenantId) {
    logger.warn(
      `[${SOURCE}] Invoice ${invoiceId} not found or no tenantId, skipping`,
    );
    return;
  }

  // Uang yang benar-benar diterima: lunas lewat gateway/verifikasi, atau
  // dicatat langsung tanpa status gateway.
  const received = await prismaBilling.payment.findMany({
    where: {
      invoiceId,
      OR: [{ gatewayStatus: "PAID" }, { gatewayStatus: null }],
    },
    orderBy: { paymentDate: "desc" },
    select: {
      id: true,
      amount: true,
      gatewayFee: true,
      accountId: true,
      expiresAt: true,
      gatewayProvider: true,
      paymentDate: true,
    },
  });
  const payments = received.map((payment) => ({
    amount: payment.amount,
    gatewayFee: payment.gatewayFee,
    accountId: payment.accountId,
    isGateway: Boolean(payment.expiresAt || payment.gatewayProvider),
  }));

  const tenantId = invoice.tenantId;
  const paidAt =
    received[0]?.paymentDate.toISOString() ??
    payload.paidAt ??
    new Date().toISOString();

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
    const entryDate = new Date(paidAt);
    await periodService.ensureCurrentPeriod(tenantId, entryDate);

    const coa = await resolveInvoiceReceiptCoa(
      tenantId,
      payments.flatMap((payment) =>
        payment.accountId && !payment.isGateway ? [payment.accountId] : [],
      ),
    );
    const lines = buildInvoicePaidLines(payments, coa);
    // Invoice yang lunas seluruhnya oleh kupon tidak menerima uang; Piutangnya
    // sudah ditutup jurnal kupon.
    if (lines.length === 0) {
      logger.info(`[${SOURCE}] Invoice ${invoiceId} lunas tanpa uang masuk`);
      return;
    }

    await postingService.postAuto(tenantId, {
      source: "AUTO_INVOICE_PAID",
      sourceRefType: "Invoice",
      sourceRefId: invoiceReceiptRef(invoiceId, received[0].id),
      entryDate,
      description: `Penerimaan pembayaran invoice ${invoice.invoiceNumber}`,
      lines,
    });

    logger.info(`[${SOURCE}] Journal posted for invoice paid ${invoiceId}`);
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
