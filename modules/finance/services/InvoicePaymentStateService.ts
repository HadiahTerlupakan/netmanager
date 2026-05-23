import { logger } from "@/lib/logger";
import { BillingEventDispatcher } from "@/modules/events";
import type { InvoiceEntity } from "../domain/entities/InvoiceEntity";
import type {
  IInvoiceRepository,
  InvoiceWithPayment,
} from "../domain/ports/IInvoiceRepository";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { InvoiceStatus } from "../types/invoice.enums";
import {
  cancelInvoiceBillingSchedules,
  syncInvoiceBillingSchedules,
} from "./billingScheduleLifecycle";

type RecomputeResult = {
  invoice: InvoiceEntity;
  previousStatus: string;
  becamePaid: boolean;
};

/**
 * Single source of truth untuk merekonsiliasi payment state sebuah invoice.
 *
 * Bertanggung jawab untuk:
 * 1. Hitung ulang `paidAmount` dari payment dengan gatewayStatus PAID/null.
 * 2. Tentukan dan persist status invoice (PAID / PARTIAL_PAID / SENT-restore).
 * 3. Sinkronisasi durable billing schedule (cancel saat PAID, sync sebaliknya).
 * 4. Emit event `INVOICE_PAID` sekali ketika invoice transisi menjadi PAID.
 *
 * Catatan: HANYA service ini yang boleh memanggil
 * `BillingEventDispatcher.onInvoicePaid` untuk transisi pembayaran.
 * Caller cukup memastikan record payment sudah ter-persist sebelum memanggil.
 */
export class InvoicePaymentStateService {
  constructor(
    private readonly invoiceRepo: IInvoiceRepository = new InvoiceRepository(),
  ) {}

  async recompute(invoiceId: string): Promise<RecomputeResult | null> {
    const invoice = await this.invoiceRepo.findWithPayment(invoiceId);
    if (!invoice) {
      logger.warn(
        `[InvoicePaymentState] Invoice ${invoiceId} tidak ditemukan saat recompute`,
      );
      return null;
    }

    const totalPaid = sumActivePayments(invoice);
    const nextStatus = resolveNextStatus(
      totalPaid,
      invoice.totalAmount,
      invoice.status as InvoiceStatus,
    );

    const updatedInvoice = await this.invoiceRepo.updatePaymentStatus(
      invoice.id,
      {
        paidAmount: totalPaid,
        status: nextStatus,
        paidAt: nextStatus === InvoiceStatus.PAID ? new Date() : null,
      },
    );

    const becamePaid =
      invoice.status !== InvoiceStatus.PAID &&
      nextStatus === InvoiceStatus.PAID;

    await this.syncSchedules(updatedInvoice, becamePaid);
    if (becamePaid) {
      await this.publishInvoicePaid(updatedInvoice);
    }

    return {
      invoice: updatedInvoice,
      previousStatus: invoice.status,
      becamePaid,
    };
  }

  private async syncSchedules(invoice: InvoiceEntity, becamePaid: boolean) {
    if (becamePaid || invoice.status === InvoiceStatus.PAID) {
      await cancelInvoiceBillingSchedules(invoice.id);
      return;
    }

    await syncInvoiceBillingSchedules(invoice);
  }

  private async publishInvoicePaid(invoice: InvoiceEntity) {
    if (!invoice.pelangganId) {
      logger.warn(
        `[InvoicePaymentState] Invoice ${invoice.id} tidak punya pelangganId — event INVOICE_PAID tidak di-emit`,
      );
      return;
    }

    await BillingEventDispatcher.onInvoicePaid(
      invoice.id,
      invoice.pelangganId,
      Number(invoice.totalAmount),
    ).catch((error) =>
      logger.error(
        "[InvoicePaymentState] Failed to publish INVOICE_PAID event",
        error instanceof Error ? error : undefined,
      ),
    );
  }
}

function sumActivePayments(invoice: InvoiceWithPayment): bigint {
  return invoice.payment.reduce<bigint>((sum, payment) => {
    const status = payment.gatewayStatus ?? null;
    if (status === null || status === "PAID") {
      return sum + payment.amount;
    }
    return sum;
  }, 0n);
}

function resolveNextStatus(
  paidAmount: bigint,
  totalAmount: bigint,
  currentStatus: InvoiceStatus,
): InvoiceStatus {
  if (paidAmount >= totalAmount && totalAmount > 0n) {
    return InvoiceStatus.PAID;
  }

  if (paidAmount > 0n) {
    return InvoiceStatus.PARTIAL_PAID;
  }

  if (currentStatus === InvoiceStatus.PAID) {
    return InvoiceStatus.SENT;
  }

  return currentStatus;
}

/** Convenience helper untuk caller yang tidak butuh result. */
export async function recomputeInvoicePaymentState(
  invoiceId: string,
): Promise<void> {
  await new InvoicePaymentStateService().recompute(invoiceId);
}
