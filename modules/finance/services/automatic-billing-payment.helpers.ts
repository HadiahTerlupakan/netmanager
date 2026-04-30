import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import { BillingEventDispatcher } from "@/modules/events";
import {
  getPelangganService,
  type PelangganBillingBridgeService,
} from "@/modules/pelanggan";
import type { InvoiceRepository } from "../repositories/InvoiceRepository";
import type { PaymentRepository } from "../repositories/PaymentRepository";
import {
  addSafeMonth,
  mapRealtimeCustomerToBillingPayload,
} from "./automatic-billing.helpers";
import type { BillingInvoiceCreationService } from "./BillingInvoiceCreationService";

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

  await options.invoiceRepo.update(options.invoice.id, {
    status: "PAID",
    paidAmount: options.invoice.totalAmount,
  });

  await options.paymentRepo.create({
    id: randomUUID(),
    pelangganId: options.pelangganId,
    invoiceId: options.invoice.id,
    amount: options.invoice.totalAmount,
    paymentDate: new Date(),
    paymentMethod: "CASH",
    reference: "REGISTRATION_PAYMENT",
    verifiedAt: new Date(),
    verifiedBy: "SYSTEM",
    notes: "Pembayaran otomatis pada saat registrasi pelanggan",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await BillingEventDispatcher.onInvoicePaid(
    options.invoice.id,
    options.pelangganId,
    Number(options.invoice.totalAmount),
  ).catch((error) =>
    logger.error(
      "Failed to publish INVOICE_PAID event",
      error instanceof Error ? error : undefined,
    ),
  );
}

/** Membuat invoice instan untuk pelanggan yang valid. */
export async function createImmediateInvoice(options: {
  pelangganId: string;
  pelangganBridge: PelangganBillingBridgeService;
  invoiceCreationService: BillingInvoiceCreationService;
  invoiceRepo: InvoiceRepository;
  paymentRepo: PaymentRepository;
  shouldMarkPaid?: boolean;
}) {
  const customer = await options.pelangganBridge.findByIdWithHargaPaket(
    options.pelangganId,
  );

  if (!customer || !customer.hargaPaket) {
    return null;
  }

  const invoice = await options.invoiceCreationService.createInvoiceForCustomer(
    mapRealtimeCustomerToBillingPayload(customer),
    new Date(),
  );

  await settleImmediateInvoice({
    pelangganId: options.pelangganId,
    invoice,
    shouldMarkPaid: options.shouldMarkPaid ?? false,
    invoiceRepo: options.invoiceRepo,
    paymentRepo: options.paymentRepo,
  });

  logger.info(
    `[Billing] Immediate invoice generated for customer ${customer.nama}, isPaid: ${Boolean(options.shouldMarkPaid)}`,
  );

  return invoice;
}

/** Menangani update jatuh tempo dan aktivasi pelanggan setelah invoice lunas. */
export async function handlePaidInvoiceCustomerState(options: {
  invoiceId: string;
  invoiceRepo: InvoiceRepository;
  pelangganBridge: PelangganBillingBridgeService;
}) {
  const invoice = await options.invoiceRepo.findUnique(options.invoiceId);
  if (!invoice || invoice.status !== "PAID") {
    return;
  }

  const customer = await options.pelangganBridge.findById(invoice.pelangganId);
  if (!customer) {
    return;
  }

  const nextDueDate = calculateNextDueDate(customer, invoice.dueDate);
  const canActivateCustomer = await shouldActivateCustomer(
    customer,
    options.invoiceRepo,
  );

  await options.pelangganBridge.updateJatuhTempo(customer.id, nextDueDate);
  if (canActivateCustomer) {
    await getPelangganService().updateStatusPelanggan(customer.id, "AKTIF");
  }

  await BillingEventDispatcher.onInvoicePaid(
    options.invoiceId,
    customer.id,
    Number(invoice.totalAmount),
  ).catch((error) =>
    logger.error(
      "Failed to publish INVOICE_PAID event",
      error instanceof Error ? error : undefined,
    ),
  );
}

function calculateNextDueDate(
  customer: { jatuhTempo: Date; tipe?: string; status?: string },
  invoiceDueDate: Date,
) {
  const today = toStartOfDay(new Date());
  const currentDueDate = new Date(customer.jatuhTempo);

  if (customer.tipe === "NON_REGULER") {
    const baseDate =
      customer.status === "ISOLIR" || currentDueDate < today
        ? today
        : currentDueDate;
    return addSafeMonth(baseDate);
  }

  const nextDueDate = addSafeMonth(invoiceDueDate);
  return nextDueDate < currentDueDate ? currentDueDate : nextDueDate;
}

async function shouldActivateCustomer(
  customer: { id: string; tipe?: string; status?: string },
  invoiceRepo: InvoiceRepository,
) {
  if (customer.status === "AKTIF") {
    return false;
  }

  if (customer.tipe !== "REGULER") {
    return true;
  }

  return (await invoiceRepo.countUnpaidByPelangganId(customer.id)) === 0;
}
