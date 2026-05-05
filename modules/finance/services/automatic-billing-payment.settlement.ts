import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { BillingEventDispatcher } from "@/modules/events";
import type { InvoiceRepository } from "../repositories/InvoiceRepository";
import type { PaymentRepository } from "../repositories/PaymentRepository";

/** Menandai invoice registrasi sebagai lunas dan membuat payment record pendukung. */
export async function settleImmediateInvoice(options: {
  pelangganId: string;
  invoice: { id: string; totalAmount: bigint } | null;
  shouldMarkPaid: boolean;
  invoiceRepo: InvoiceRepository;
  paymentRepo: PaymentRepository;
}) {
  const settlement = getImmediateSettlement(options);
  if (!settlement) {
    return;
  }

  await executeImmediateSettlement(settlement);
}

function getImmediateSettlement(options: {
  pelangganId: string;
  invoice: { id: string; totalAmount: bigint } | null;
  shouldMarkPaid: boolean;
  invoiceRepo: InvoiceRepository;
  paymentRepo: PaymentRepository;
}) {
  if (!options.shouldMarkPaid || !options.invoice) {
    return null;
  }

  return {
    pelangganId: options.pelangganId,
    invoice: options.invoice,
    invoiceRepo: options.invoiceRepo,
    paymentRepo: options.paymentRepo,
  };
}

async function executeImmediateSettlement(options: {
  pelangganId: string;
  invoice: { id: string; totalAmount: bigint };
  invoiceRepo: InvoiceRepository;
  paymentRepo: PaymentRepository;
}) {
  await markInvoiceAsPaid(options.invoiceRepo, options.invoice);
  await createInvoicePaymentRecord(options.paymentRepo, options);
  await publishInvoicePaidEvent({
    invoiceId: options.invoice.id,
    customerId: options.pelangganId,
    totalAmount: options.invoice.totalAmount,
  });
}

async function markInvoiceAsPaid(
  invoiceRepo: InvoiceRepository,
  invoice: { id: string; totalAmount: bigint },
) {
  await invoiceRepo.update(invoice.id, {
    status: "PAID",
    paidAmount: invoice.totalAmount,
  });
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

async function publishInvoicePaidEvent(input: {
  invoiceId: string;
  customerId: string;
  totalAmount: bigint;
}) {
  await BillingEventDispatcher.onInvoicePaid(
    input.invoiceId,
    input.customerId,
    Number(input.totalAmount),
  ).catch((error) =>
    logger.error(
      "Failed to publish INVOICE_PAID event",
      error instanceof Error ? error : undefined,
    ),
  );
}
