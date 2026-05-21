import { logger } from "@/lib/logger";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import type { PelangganBillingBridgeService as IPelangganBillingBridge } from "@/modules/pelanggan";
import type { InvoiceRepository } from "../repositories/InvoiceRepository";
import type { PaymentRepository } from "../repositories/PaymentRepository";
import {
  addSafeMonth,
  mapRealtimeCustomerToBillingPayload,
} from "./automatic-billing.helpers";
import type { BillingInvoiceCreationService } from "./BillingInvoiceCreationService";
import { settleImmediateInvoice } from "./automatic-billing-payment.settlement";

type ImmediateInvoiceCustomer = NonNullable<
  Awaited<ReturnType<IPelangganBillingBridge["findByIdWithHargaPaket"]>>
>;
type PaidInvoiceCustomer = NonNullable<
  Awaited<ReturnType<IPelangganBillingBridge["findById"]>>
>;
type PaidInvoice = NonNullable<
  Awaited<ReturnType<InvoiceRepository["findUnique"]>>
>;

/** Membuat invoice instan untuk pelanggan yang valid. */
export async function createImmediateInvoice(options: {
  pelangganId: string;
  pelangganBridge: IPelangganBillingBridge;
  invoiceCreationService: BillingInvoiceCreationService;
  invoiceRepo: InvoiceRepository;
  paymentRepo: PaymentRepository;
  shouldMarkPaid?: boolean;
}) {
  const customer = await loadImmediateInvoiceCustomer(
    options.pelangganBridge,
    options.pelangganId,
  );
  if (!customer) {
    return null;
  }

  return finalizeImmediateInvoiceCreation(options, customer);
}

async function finalizeImmediateInvoiceCreation(
  options: {
    pelangganId: string;
    invoiceCreationService: BillingInvoiceCreationService;
    invoiceRepo: InvoiceRepository;
    paymentRepo: PaymentRepository;
    shouldMarkPaid?: boolean;
  },
  customer: ImmediateInvoiceCustomer,
) {
  const invoice = await createCustomerInvoice(options, customer);
  await settleImmediateInvoice({
    pelangganId: options.pelangganId,
    invoice,
    shouldMarkPaid: options.shouldMarkPaid ?? false,
    invoiceRepo: options.invoiceRepo,
    paymentRepo: options.paymentRepo,
  });
  logImmediateInvoiceGeneration(customer.nama, Boolean(options.shouldMarkPaid));
  return invoice;
}

async function loadImmediateInvoiceCustomer(
  pelangganBridge: IPelangganBillingBridge,
  pelangganId: string,
) {
  const customer = await pelangganBridge.findByIdWithHargaPaket(pelangganId);
  if (!customer || !customer.hargaPaket) {
    return null;
  }

  return customer as ImmediateInvoiceCustomer;
}

async function createCustomerInvoice(
  options: {
    invoiceCreationService: BillingInvoiceCreationService;
  },
  customer: ImmediateInvoiceCustomer,
) {
  return options.invoiceCreationService.createInvoiceForCustomer(
    mapRealtimeCustomerToBillingPayload(customer),
    new Date(),
  );
}

function logImmediateInvoiceGeneration(customerName: string, isPaid: boolean) {
  logger.info(
    `[Billing] Immediate invoice generated for customer ${customerName}, isPaid: ${isPaid}`,
  );
}

/**
 * Menangani update jatuh tempo dan cancel schedule setelah invoice lunas.
 *
 * IMPORTANT: Fungsi ini di-invoke dari handler `INVOICE_PAID` (via
 * `AutomaticBillingService.handleInvoicePaid`). JANGAN emit event
 * `INVOICE_PAID` lagi di sini — akan menyebabkan infinite loop karena
 * handler yang sama akan dipicu kembali.
 */
export async function handlePaidInvoiceCustomerState(options: {
  invoiceId: string;
  invoiceRepo: InvoiceRepository;
  pelangganBridge: IPelangganBillingBridge;
}) {
  const invoice = await loadPaidInvoice(options.invoiceRepo, options.invoiceId);
  if (!isPaidInvoice(invoice)) {
    return;
  }

  await syncPaidInvoiceCustomerState(
    { pelangganBridge: options.pelangganBridge },
    invoice,
  );
}

async function syncPaidInvoiceCustomerState(
  options: {
    pelangganBridge: IPelangganBillingBridge;
  },
  invoice: PaidInvoice,
) {
  const customer = await loadPaidInvoiceCustomer(
    options.pelangganBridge,
    invoice.pelangganId,
  );
  if (!customer) {
    return;
  }

  const nextDueDate = calculateNextDueDate(customer, invoice.dueDate);
  await syncPaidCustomerDueDate(
    {
      customer,
      pelangganBridge: options.pelangganBridge,
    },
    nextDueDate,
  );
  const { cancelInvoiceBillingSchedules } =
    await import("./billingScheduleLifecycle");
  await cancelInvoiceBillingSchedules(invoice.id);
}

async function loadPaidInvoice(
  invoiceRepo: InvoiceRepository,
  invoiceId: string,
) {
  return invoiceRepo.findUnique(invoiceId);
}

function isPaidInvoice(invoice: PaidInvoice | null): invoice is PaidInvoice {
  return Boolean(invoice && invoice.status === "PAID");
}

async function loadPaidInvoiceCustomer(
  pelangganBridge: IPelangganBillingBridge,
  pelangganId: string,
) {
  const customer = await pelangganBridge.findById(pelangganId);
  if (!customer) {
    return null;
  }

  return customer as PaidInvoiceCustomer;
}

/** Update jatuh tempo pelanggan setelah invoice lunas. Aktivasi ditangani oleh INVOICE_PAID event handler. */
async function syncPaidCustomerDueDate(
  options: {
    customer: PaidInvoiceCustomer;
    pelangganBridge: IPelangganBillingBridge;
  },
  nextDueDate: Date,
) {
  await options.pelangganBridge.updateJatuhTempo(
    options.customer.id,
    nextDueDate,
  );
  // Activation customer handled by INVOICE_PAID event handler di lib/event-bus/event-handlers.ts
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
