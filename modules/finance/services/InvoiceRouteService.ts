import type { Prisma } from "../lib/billing-prisma-boundary";
import type { InvoiceStatus } from "../types/invoice.enums";
import { getPelangganServiceFromRegistry } from "../pelanggan-registry";
import { UserLookupService } from "@/modules/users";
import { InvoiceRepository } from "../repositories/InvoiceRepository";

type RouteUser = {
  id: string;
  role?: string | null;
};

type InvoiceItemInput = {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type InvoiceUpdateInput = {
  invoiceNumber?: string;
  pelangganId?: string;
  siteId?: string | null;
  issueDate?: Date;
  dueDate?: Date;
  status?: InvoiceStatus;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  notes?: string | null;
  terms?: string | null;
  invoiceItem?: InvoiceItemInput[];
};

type InvoiceResponseShape = {
  pelangganId: string | null;
  subtotal: bigint;
  taxAmount: bigint;
  discountAmount: bigint;
  totalAmount: bigint;
  paidAmount: bigint;
  invoiceItem?: Array<{
    unitPrice: bigint;
    totalPrice: bigint;
  }>;
  items?: Array<{
    unitPrice: bigint;
    totalPrice: bigint;
  }>;
  payment?: Array<{ amount: bigint }>;
  payments?: Array<{ amount: bigint }>;
};

const invoiceRepository = new InvoiceRepository();
const userLookupService = new UserLookupService();

function getPelangganLookupService() {
  return getPelangganServiceFromRegistry();
}

/** Returns invoice detail data for route responses. */
export async function getInvoiceForRoute(options: {
  invoiceId: string;
  user: RouteUser;
  isRestricted: boolean;
}) {
  const invoice = await findInvoiceByAccess(options);
  if (!invoice) {
    return null;
  }

  const pelanggan = await getPelangganLookupService().getPelanggan(
    invoice.pelangganId,
  );

  return {
    ...formatInvoiceResponse(invoice),
    pelanggan,
  };
}

/** Updates invoice data and items for route responses. */
export async function updateInvoiceForRoute(options: {
  invoiceId: string;
  user: RouteUser;
  isRestricted: boolean;
  input: InvoiceUpdateInput;
}) {
  const existingInvoice = await findInvoiceByAccess(options);
  if (!existingInvoice) return null;

  const restrictedSiteId = await resolveUpdateSiteRestriction(options);
  if (restrictedSiteId === "forbidden-site") {
    return "forbidden-site" as const;
  }

  return await performInvoiceUpdate(options, restrictedSiteId);
}

async function performInvoiceUpdate(
  options: { invoiceId: string; input: InvoiceUpdateInput },
  restrictedSiteId: string | undefined,
) {
  const updatedInvoice = await invoiceRepository.updateWithItemsTransaction({
    invoiceId: options.invoiceId,
    invoiceItem: options.input.invoiceItem,
    updateData: buildInvoiceUpdateData(options.input, restrictedSiteId),
  });
  const { syncInvoiceBillingSchedules } =
    await import("./billingScheduleLifecycle");
  await syncInvoiceBillingSchedules(updatedInvoice);
  return buildInvoiceWithPelanggan(updatedInvoice);
}

async function resolveUpdateSiteRestriction(options: {
  user: RouteUser;
  isRestricted: boolean;
  input: InvoiceUpdateInput;
}) {
  const restrictedSiteId = options.isRestricted
    ? await getRestrictedSiteId(options.user.id)
    : undefined;

  if (isForbiddenSiteChange(options.input, restrictedSiteId)) {
    return "forbidden-site" as const;
  }

  return restrictedSiteId;
}

async function buildInvoiceWithPelanggan(
  invoice: InvoiceResponseShape & { pelangganId: string | null },
) {
  const pelanggan = await getPelangganLookupService().getPelanggan(
    invoice.pelangganId,
  );
  return { ...formatInvoiceResponse(invoice), pelanggan };
}

type InvoiceSendInput = {
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  sendMethod: "EMAIL" | "WHATSAPP" | "BOTH";
};

/** Marks a draft invoice as sent after validating recipient contact. */
export async function sendInvoiceForRoute(options: {
  invoiceId: string;
  user: RouteUser;
  input: InvoiceSendInput;
}) {
  const invoice = await loadDraftInvoiceForSend(options);
  if (!invoice || invoice.status !== "DRAFT") {
    return { status: invoice ? "not-draft" : "not-found" } as const;
  }

  const contact = await resolveSendContact(invoice.pelangganId, options.input);
  if (!contact.email && !contact.phone) {
    return { status: "missing-contact" as const };
  }

  return await executeSendInvoice(options, contact);
}

async function executeSendInvoice(
  options: { invoiceId: string; input: InvoiceSendInput },
  contact: { email: string | null; phone: string | null },
) {
  const sentVia = resolveSentChannels(
    options.input.sendMethod,
    contact.email,
    contact.phone,
  );
  if (sentVia.status !== "ok") return sentVia;

  const invoice = await invoiceRepository.markAsSent(options.invoiceId);
  const { syncInvoiceBillingSchedules } =
    await import("./billingScheduleLifecycle");
  await syncInvoiceBillingSchedules(invoice);
  return { status: "sent" as const, sentVia: sentVia.sentVia };
}

async function loadDraftInvoiceForSend(options: {
  invoiceId: string;
  user: RouteUser;
}) {
  const userSiteId = await getRestrictedSiteId(options.user.id);
  const invoice = await invoiceRepository.findInvoiceForSend(options.invoiceId);
  if (!invoice) {
    return null;
  }
  if (userSiteId && invoice.siteId && invoice.siteId !== userSiteId) {
    return null;
  }
  return invoice;
}

async function resolveSendContact(
  pelangganId: string | null,
  input: InvoiceSendInput,
) {
  const pelanggan = await getPelangganLookupService().getPelanggan(pelangganId);
  return {
    email: input.recipientEmail || pelanggan?.email,
    phone: input.recipientPhone || pelanggan?.noTelp,
  };
}

/** Deletes an invoice after applying route access checks. */
export async function deleteInvoiceForRoute(options: {
  invoiceId: string;
  user: RouteUser;
  isRestricted: boolean;
}) {
  const existingInvoice = await findInvoiceByAccess(options);
  if (!existingInvoice) {
    return false;
  }

  const { cancelInvoiceBillingSchedules } =
    await import("./billingScheduleLifecycle");
  await cancelInvoiceBillingSchedules(options.invoiceId);
  await invoiceRepository.deleteById(options.invoiceId);
  return true;
}

async function findInvoiceByAccess(options: {
  invoiceId: string;
  user: RouteUser;
  isRestricted: boolean;
}) {
  if (!options.isRestricted) {
    return invoiceRepository.findWithItemsAndPayments(options.invoiceId);
  }

  const siteId = await getRestrictedSiteId(options.user.id);
  if (!siteId) {
    return null;
  }

  return invoiceRepository.findWithItemsAndPaymentsBySite(
    options.invoiceId,
    siteId,
  );
}

async function getRestrictedSiteId(userId: string) {
  const user = await userLookupService.findByIdWithSite(userId);
  return user?.siteId || undefined;
}

function resolveSentChannels(
  sendMethod: InvoiceSendInput["sendMethod"],
  email?: string | null,
  phone?: string | null,
) {
  const sentVia: string[] = [];

  if (sendMethod === "EMAIL" || sendMethod === "BOTH") {
    if (!email) {
      return { status: "missing-email" as const };
    }
    sentVia.push("EMAIL");
  }

  if (sendMethod === "WHATSAPP" || sendMethod === "BOTH") {
    if (!phone) {
      return { status: "missing-phone" as const };
    }
    sentVia.push("WHATSAPP");
  }

  return { status: "ok" as const, sentVia };
}

function isForbiddenSiteChange(
  input: InvoiceUpdateInput,
  restrictedSiteId?: string,
) {
  return Boolean(
    restrictedSiteId && input.siteId && input.siteId !== restrictedSiteId,
  );
}

function buildInvoiceUpdateData(
  input: InvoiceUpdateInput,
  restrictedSiteId?: string,
): Prisma.InvoiceUpdateInput {
  const { invoiceItem: _invoiceItem, ...rest } = input;

  return {
    ...rest,
    ...(restrictedSiteId ? { siteId: restrictedSiteId } : {}),
    ...(input.subtotal !== undefined
      ? { subtotal: BigInt(input.subtotal) }
      : {}),
    ...(input.taxAmount !== undefined
      ? { taxAmount: BigInt(input.taxAmount) }
      : {}),
    ...(input.discountAmount !== undefined
      ? { discountAmount: BigInt(input.discountAmount) }
      : {}),
    ...(input.totalAmount !== undefined
      ? { totalAmount: BigInt(input.totalAmount) }
      : {}),
  };
}

function formatInvoiceResponse(invoice: InvoiceResponseShape) {
  const items = invoice.invoiceItem ?? invoice.items ?? [];
  const payments = invoice.payment ?? invoice.payments ?? [];

  return {
    ...invoice,
    ...formatInvoiceAmounts(invoice),
    invoiceItem: formatInvoiceItems(items),
    payment: formatPaymentAmounts(payments),
  };
}

function formatInvoiceAmounts(invoice: InvoiceResponseShape) {
  return {
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    discountAmount: Number(invoice.discountAmount),
    totalAmount: Number(invoice.totalAmount),
    paidAmount: Number(invoice.paidAmount),
  };
}

function formatInvoiceItems(items: InvoiceResponseShape["invoiceItem"]) {
  return items.map((item) => ({
    ...item,
    unitPrice: Number(item.unitPrice),
    totalPrice: Number(item.totalPrice),
  }));
}

function formatPaymentAmounts(payments: InvoiceResponseShape["payment"]) {
  return payments.map((payment) => ({
    ...payment,
    amount: Number(payment.amount),
  }));
}
