import { logger } from "@/lib/logger";
import type { Prisma } from "../../lib/billing-prisma-boundary";
import { InvoiceStatus } from "../../types/invoice.enums";
import { InvoiceRepository } from "../../repositories/InvoiceRepository";
import { AutomaticBillingService } from "../AutomaticBillingService";
import { extractInvoiceIdsFromNotes } from "./webhook-utils";

type BillingTx = Prisma.TransactionClient;

/** Mengupdate invoice dan menjalankan side effect setelah webhook payment paid. */
export class WebhookInvoiceSettlementService {
  constructor(private readonly invoiceRepository = new InvoiceRepository()) {}

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

  /** Jalankan side effects setelah invoice benar-benar paid. */
  async runPostPaidSideEffects(invoiceId: string | null, notes: string | null) {
    const invoiceIds = extractInvoiceIdsFromNotes(notes);
    if (invoiceIds.length === 0 && invoiceId) {
      invoiceIds.push(invoiceId);
    }

    for (const invId of invoiceIds) {
      const invoice = await this.invoiceRepository.findUniqueAuth(invId);
      if (invoice?.status !== "PAID") {
        continue;
      }

      await AutomaticBillingService.handleInvoicePaid(invId).catch((err) => {
        logger.error(
          `[Webhook] Error triggering side-effects for invoice ${invId}:`,
          err,
        );
      });
    }
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
    const invoice =
      await this.invoiceRepository.findUniqueAuthWithPayment(invoiceId);

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
