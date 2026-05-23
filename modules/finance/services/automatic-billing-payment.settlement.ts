import { randomUUID } from "crypto";
import type { InvoiceRepository } from "../repositories/InvoiceRepository";
import type { PaymentRepository } from "../repositories/PaymentRepository";
import { InvoicePaymentStateService } from "./InvoicePaymentStateService";

/** Menandai invoice registrasi sebagai lunas dan membuat payment record pendukung. */
export async function settleImmediateInvoice(options: {
  pelangganId: string;
  invoice: { id: string; totalAmount: bigint } | null;
  shouldMarkPaid: boolean;
  invoiceRepo: InvoiceRepository;
  paymentRepo: PaymentRepository;
}) {
  if (!options.shouldMarkPaid || !options.invoice) {
    return;
  }

  await createInvoicePaymentRecord(options.paymentRepo, {
    pelangganId: options.pelangganId,
    invoice: options.invoice,
  });

  // Recompute akan mark invoice PAID berdasarkan payment yang baru dibuat,
  // emit INVOICE_PAID sekali, dan cancel durable billing schedule.
  await new InvoicePaymentStateService(options.invoiceRepo).recompute(
    options.invoice.id,
  );
}

async function createInvoicePaymentRecord(
  paymentRepo: PaymentRepository,
  options: {
    pelangganId: string;
    invoice: { id: string; totalAmount: bigint };
  },
) {
  await paymentRepo.create(buildPaymentRecord(options));
}

function buildPaymentRecord(options: {
  pelangganId: string;
  invoice: { id: string; totalAmount: bigint };
}) {
  const now = new Date();
  return {
    id: randomUUID(),
    pelangganId: options.pelangganId,
    invoiceId: options.invoice.id,
    amount: options.invoice.totalAmount,
    paymentDate: now,
    paymentMethod: "CASH" as const,
    reference: "REGISTRATION_PAYMENT",
    verifiedAt: now,
    verifiedBy: "SYSTEM",
    notes: "Pembayaran otomatis pada saat registrasi pelanggan",
    createdAt: now,
    updatedAt: now,
  };
}
