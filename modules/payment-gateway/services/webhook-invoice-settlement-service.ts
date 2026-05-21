import { logger } from "@/lib/logger";
import type { Prisma } from "@/modules/finance";
import { InvoiceStatus } from "@/modules/finance/types/invoice.enums";
import { FinanceRepositoryFacade } from "@/modules/finance";
import { extractInvoiceIdsFromNotes } from "./webhook-utils";

type BillingTx = Prisma.TransactionClient;

/** Mengupdate invoice dan menjalankan side effect setelah webhook payment paid. */
export class WebhookInvoiceSettlementService {
  constructor(
    private readonly invoiceRepository = FinanceRepositoryFacade.createInvoiceRepository(),
  ) {}

  /** Update invoice paid amount dan status dalam transaction payment. */
  async updateInvoicesOnPaymentTx(
    tx: BillingTx,
    paymentId: string,
    notes: string | null,
  ) {
    const invoiceIds = await this.resolveInvoiceIds(tx, paymentId, notes);
    for (const invoiceId of invoiceIds) {
      await this.updateInvoiceStatus(tx, invoiceId);
    }
  }

  /** Update invoice paid amount dan status (wrapper without transaction). */
  async updateInvoicesOnPayment(paymentId: string, notes: string | null) {
    const { prismaBillingAuth } = await import("@/lib/prisma-billing");
    await prismaBillingAuth.$transaction(async (tx) => {
      await this.updateInvoicesOnPaymentTx(tx, paymentId, notes);
    });
  }

  /**
   * @deprecated Sejak Phase 4 (Event-Driven Refactor). Side effects sekarang
   * dipicu via event INVOICE_PAID yang di-emit dalam payment transaction
   * (saveToOutboxTx). Method ini sengaja di-kosongkan supaya call site lama
   * tidak double-emit. Akan dihapus total di release berikutnya.
   */
  async runPostPaidSideEffects(
    _invoiceId: string | null,
    _notes: string | null,
  ) {
    // No-op intentional — lihat JSDoc
  }

  private async resolveInvoiceIds(
    tx: BillingTx,
    paymentId: string,
    notes: string | null,
  ) {
    const invoiceIds = extractInvoiceIdsFromNotes(notes);
    if (invoiceIds.length > 0) {
      return invoiceIds;
    }

    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      select: { invoiceId: true },
    });
    return payment?.invoiceId ? [payment.invoiceId] : [];
  }

  private async updateInvoiceStatus(tx: BillingTx, invoiceId: string) {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        payment: {
          select: { amount: true, gatewayStatus: true },
        },
      },
    });

    if (!invoice) {
      logger.warn(`[Webhook] Invoice ${invoiceId} not found`);
      return;
    }

    const totalPaid = invoice.payment.reduce((sum, payment) => {
      if (!payment.gatewayStatus || payment.gatewayStatus === "PAID") {
        return sum + BigInt(payment.amount);
      }
      return sum;
    }, BigInt(0));
    const invoiceStatus = calculateInvoiceStatus(
      totalPaid,
      invoice.totalAmount,
      invoice.status as InvoiceStatus,
    );

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: totalPaid,
        status: invoiceStatus,
        ...(invoiceStatus === "PAID" ? { paidAt: new Date() } : {}),
      },
    });
  }
}

function calculateInvoiceStatus(
  totalPaid: bigint,
  totalAmount: bigint,
  currentStatus: InvoiceStatus,
) {
  if (totalPaid >= totalAmount) {
    return InvoiceStatus.PAID;
  }

  if (totalPaid > BigInt(0)) {
    return InvoiceStatus.PARTIAL_PAID;
  }

  return currentStatus;
}
