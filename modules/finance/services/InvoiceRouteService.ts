import type { InvoiceStatus, Prisma } from "@prisma/client-billing";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { PelangganRepository } from "@/modules/pelanggan";
import { UserRepository } from "@/modules/users";

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
const userRepository = new UserRepository();

function getPelangganRepository() {
  return new PelangganRepository();
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

  const pelanggan = await getPelangganRepository().findById(
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
  if (!existingInvoice) {
    return null;
  }

  const restrictedSiteId = options.isRestricted
    ? await getRestrictedSiteId(options.user.id)
    : undefined;

  if (isForbiddenSiteChange(options.input, restrictedSiteId)) {
    return "forbidden-site" as const;
  }

  const updatedInvoice = await invoiceRepository.updateWithItemsTransaction({
    invoiceId: options.invoiceId,
    invoiceItem: options.input.invoiceItem,
    updateData: buildInvoiceUpdateData(options.input, restrictedSiteId),
  });
  const pelanggan = await getPelangganRepository().findById(
    updatedInvoice.pelangganId,
  );

  return {
    ...formatInvoiceResponse(updatedInvoice),
    pelanggan,
  };
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
  const userSiteId = await getRestrictedSiteId(options.user.id);
  const invoice = await invoiceRepository.findInvoiceForSend(options.invoiceId);
  if (!invoice) {
    return { status: "not-found" as const };
  }

  if (userSiteId && invoice.siteId && invoice.siteId !== userSiteId) {
    return { status: "not-found" as const };
  }

  if (invoice.status !== "DRAFT") {
    return { status: "not-draft" as const };
  }

  const pelanggan = await getPelangganRepository().findById(
    invoice.pelangganId,
  );
  const email = options.input.recipientEmail || pelanggan?.email;
  const phone = options.input.recipientPhone || pelanggan?.noTelp;

  if (!email && !phone) {
    return { status: "missing-contact" as const };
  }

  const sentVia = resolveSentChannels(options.input.sendMethod, email, phone);
  if (sentVia.status !== "ok") {
    return sentVia;
  }

  await invoiceRepository.markAsSent(options.invoiceId);
  return { status: "sent" as const, sentVia: sentVia.sentVia };
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
  const user = await userRepository.findByIdWithSite(userId);
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
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    discountAmount: Number(invoice.discountAmount),
    totalAmount: Number(invoice.totalAmount),
    paidAmount: Number(invoice.paidAmount),
    invoiceItem: items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
    })),
    payment: payments.map((payment) => ({
      ...payment,
      amount: Number(payment.amount),
    })),
  };
}
