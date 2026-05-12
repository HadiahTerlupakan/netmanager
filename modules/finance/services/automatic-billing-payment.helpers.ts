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
import { settleImmediateInvoice } from "./automatic-billing-payment.settlement";

type ImmediateInvoiceCustomer = NonNullable<
  Awaited<ReturnType<PelangganBillingBridgeService["findByIdWithHargaPaket"]>>
>;
type PaidInvoiceCustomer = NonNullable<
  Awaited<ReturnType<PelangganBillingBridgeService["findById"]>>
>;
type PaidInvoice = NonNullable<
  Awaited<ReturnType<InvoiceRepository["findUnique"]>>
>;

/** Membuat invoice instan untuk pelanggan yang valid. */
export async function createImmediateInvoice(options: {
  pelangganId: string;
  pelangganBridge: PelangganBillingBridgeService;
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
  pelangganBridge: PelangganBillingBridgeService,
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

/** Menangani update jatuh tempo dan aktivasi pelanggan setelah invoice lunas. */
export async function handlePaidInvoiceCustomerState(options: {
  invoiceId: string;
  invoiceRepo: InvoiceRepository;
  pelangganBridge: PelangganBillingBridgeService;
}) {
  const invoice = await loadPaidInvoice(options.invoiceRepo, options.invoiceId);
  if (!isPaidInvoice(invoice)) {
    return;
  }

  await syncPaidInvoiceCustomerState(options, invoice);
}

async function syncPaidInvoiceCustomerState(
  options: {
    invoiceRepo: InvoiceRepository;
    pelangganBridge: PelangganBillingBridgeService;
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
      invoiceRepo: options.invoiceRepo,
      pelangganBridge: options.pelangganBridge,
    },
    nextDueDate,
  );
  const { cancelInvoiceBillingSchedules } =
    await import("./billingScheduleLifecycle");
  await cancelInvoiceBillingSchedules(invoice.id);
  await publishPaidInvoiceEvent(invoice, customer.id);
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
  pelangganBridge: PelangganBillingBridgeService,
  pelangganId: string,
) {
  const customer = await pelangganBridge.findById(pelangganId);
  if (!customer) {
    return null;
  }

  return customer as PaidInvoiceCustomer;
}

async function syncPaidCustomerDueDate(
  options: {
    customer: PaidInvoiceCustomer;
    invoiceRepo: InvoiceRepository;
    pelangganBridge: PelangganBillingBridgeService;
  },
  nextDueDate: Date,
) {
  const canActivateCustomer = await shouldActivateCustomer(
    options.customer,
    options.invoiceRepo,
  );

  await options.pelangganBridge.updateJatuhTempo(
    options.customer.id,
    nextDueDate,
  );
  await activateCustomerIfNeeded(options.customer.id, canActivateCustomer);
}

async function publishPaidInvoiceEvent(
  invoice: PaidInvoice,
  customerId: string,
) {
  await BillingEventDispatcher.onInvoicePaid(
    invoice.id,
    customerId,
    Number(invoice.totalAmount),
  ).catch((error) =>
    logger.error(
      "Failed to publish INVOICE_PAID event",
      error instanceof Error ? error : undefined,
    ),
  );
}

async function activateCustomerIfNeeded(
  customerId: string,
  shouldActivate: boolean,
) {
  if (!shouldActivate) {
    return;
  }

  await getPelangganService().updateStatusPelanggan(customerId, "AKTIF");
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
