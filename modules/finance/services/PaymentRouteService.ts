import { randomUUID } from "crypto";
import {
  GatewayPaymentStatus,
  InvoiceStatus,
  PaymentMethod,
  Prisma as PrismaBilling,
} from "../repositories/billing-prisma-boundary";
import { logActivitySafe } from "@/lib/logger";
import { getPelangganService } from "@/modules/pelanggan";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { PaymentRepository } from "../repositories/PaymentRepository";

type PaymentListFilters = {
  pelangganId?: string | null;
  invoiceId?: string | null;
  paymentMethod?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  page: number;
  limit: number;
};

type PaymentCreateInput = {
  invoiceId?: string | null;
  pelangganId: string;
  amount: number;
  paymentDate?: string | Date;
  paymentMethod: PaymentMethod;
  paymentStatus?: GatewayPaymentStatus | null;
  reference?: string | null;
  notes?: string | null;
};

type RouteUser = {
  id: string;
};

type PaymentAccessUser = {
  isSuperAdmin?: boolean;
  siteId?: string | null;
  tenantId?: string | null;
};

type PaymentCreateResult =
  | { status: "pelanggan-not-found" }
  | { status: "invoice-not-found" }
  | { status: "created"; data: unknown };

export type PaymentRouteError =
  | { status: "foreign-key-error" }
  | { status: "unknown"; message: string };

function getInvoiceRepository() {
  return new InvoiceRepository();
}

function getPaymentRepository() {
  return new PaymentRepository();
}

function getPelangganLookupService() {
  return getPelangganService();
}

/** Lists payments for route responses with pagination. */
export async function listPaymentsForRoute(options: {
  filters: PaymentListFilters;
}) {
  const result = await getPaymentRepository().findPaginatedWithInvoice({
    where: buildPaymentWhere(options.filters),
    page: options.filters.page,
    limit: options.filters.limit,
  });

  return buildPaginatedResponse(result, options.filters);
}

function buildPaginatedResponse(
  result: { data: unknown[]; total: number },
  filters: { page: number; limit: number },
) {
  const totalPages = Math.ceil(result.total / filters.limit);
  return {
    data: result.data,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages,
      hasNext: filters.page < totalPages,
      hasPrev: filters.page > 1,
    },
  };
}

/** Returns a single payment with access checks. */
export async function getPaymentForRoute(options: {
  paymentId: string;
  user?: PaymentAccessUser;
}) {
  const payment = await getPaymentRepository().findByIdWithInvoice(
    options.paymentId,
  );
  if (!payment) {
    return { status: "not-found" as const };
  }
  if (!options.user || options.user.isSuperAdmin) {
    return { status: "ok" as const, data: payment };
  }
  return assertPaymentAccess(payment, options.user);
}

function assertPaymentAccess(
  payment: {
    invoice?: { siteId?: string | null } | null;
    tenantId?: string | null;
  },
  user: PaymentAccessUser,
) {
  const siteId = payment.invoice?.siteId;
  if (siteId && siteId !== user.siteId) {
    return { status: "forbidden-site" as const };
  }
  if (!siteId && payment.tenantId && payment.tenantId !== user.tenantId) {
    return { status: "forbidden-tenant" as const };
  }
  return { status: "ok" as const, data: payment };
}

export function mapPaymentRouteError(error: unknown): PaymentRouteError {
  if (error instanceof PrismaBilling.PrismaClientKnownRequestError) {
    if (error.code === "P2003") return { status: "foreign-key-error" };
  }

  return {
    status: "unknown",
    message:
      error instanceof Error ? error.message : "Terjadi kesalahan server",
  };
}

export async function createPaymentForRoute(options: {
  input: PaymentCreateInput;
  user: RouteUser;
}): Promise<PaymentCreateResult> {
  const pelanggan = await getPelangganLookupService().getPelanggan(
    options.input.pelangganId,
  );
  if (!pelanggan) {
    return { status: "pelanggan-not-found" };
  }

  const invoiceValidation = await validateLinkedInvoice(
    options.input.invoiceId,
  );
  if (invoiceValidation.status !== "ok") {
    return invoiceValidation;
  }

  return await executePaymentCreation(options);
}

async function executePaymentCreation(options: {
  input: PaymentCreateInput;
  user: RouteUser;
}) {
  const payment = await createPaymentRecord(options);
  await syncLinkedInvoicePaymentStatus(options.input.invoiceId);
  logCreatedPaymentActivity(payment, options);
  return { status: "created" as const, data: payment };
}

/** Validates the linked invoice before creating a manual payment. */
async function validateLinkedInvoice(invoiceId?: string | null) {
  if (!invoiceId) {
    return { status: "ok" as const };
  }

  const invoice = await getInvoiceRepository().findRawById(invoiceId);
  return invoice
    ? { status: "ok" as const }
    : { status: "invoice-not-found" as const };
}

/** Creates a payment record using route input defaults. */
async function createPaymentRecord(options: {
  input: PaymentCreateInput;
  user: RouteUser;
}) {
  return getPaymentRepository().createWithInvoice(
    buildPaymentCreateData(options),
  );
}

function buildPaymentCreateData(options: {
  input: PaymentCreateInput;
  user: RouteUser;
}) {
  return {
    id: randomUUID(),
    paymentDate: options.input.paymentDate
      ? new Date(options.input.paymentDate)
      : new Date(),
    paymentMethod: options.input.paymentMethod,
    gatewayStatus: options.input.paymentStatus || GatewayPaymentStatus.PAID,
    reference: options.input.reference ?? null,
    notes: options.input.notes ?? null,
    invoiceId: options.input.invoiceId || null,
    pelangganId: options.input.pelangganId,
    amount: BigInt(Math.round(options.input.amount)),
    verifiedBy: options.user.id,
    updatedAt: new Date(),
  };
}

/** Updates invoice payment status only when a linked invoice exists. */
async function syncLinkedInvoicePaymentStatus(invoiceId?: string | null) {
  if (!invoiceId) {
    return;
  }

  await updateLinkedInvoicePaymentStatus(invoiceId);
}

/** Logs payment creation using route-compatible activity payload. */
function logCreatedPaymentActivity(
  payment: { id: string; amount: bigint },
  options: { input: PaymentCreateInput; user: RouteUser },
) {
  logActivitySafe({
    action: "CREATE",
    subject: "Payment",
    userId: options.user.id,
    details: {
      id: payment.id,
      amount: Number(payment.amount),
      method: options.input.paymentMethod,
    },
  });
}

function buildPaymentWhere(filters: PaymentListFilters) {
  const where: PrismaBilling.PaymentWhereInput = {};

  if (filters.pelangganId) {
    where.pelangganId = filters.pelangganId;
  }
  if (filters.invoiceId) {
    where.invoiceId = filters.invoiceId;
  }
  if (filters.paymentMethod) {
    where.paymentMethod = filters.paymentMethod as PaymentMethod;
  }
  if (filters.startDate || filters.endDate) {
    where.paymentDate = buildPaymentDateFilter(filters);
  }

  return where;
}

function buildPaymentDateFilter(filters: PaymentListFilters) {
  const paymentDate: { gte?: Date; lte?: Date } = {};

  if (filters.startDate) {
    paymentDate.gte = new Date(filters.startDate);
  }
  if (filters.endDate) {
    paymentDate.lte = new Date(filters.endDate);
  }

  return paymentDate;
}

async function updateLinkedInvoicePaymentStatus(invoiceId: string) {
  const invoice = await getInvoiceRepository().findWithPayment(invoiceId);
  if (!invoice) {
    return;
  }

  const totalPaid = invoice.payment.reduce(
    (sum, payment) => sum + payment.amount,
    0n,
  );
  await getInvoiceRepository().updatePaymentStatus(invoiceId, {
    paidAmount: totalPaid,
    status: calculateInvoiceStatus(
      totalPaid,
      invoice.totalAmount,
      invoice.status as InvoiceStatus,
    ),
    paidAt: totalPaid >= invoice.totalAmount ? new Date() : null,
  });
}

function calculateInvoiceStatus(
  totalPaid: bigint,
  totalAmount: bigint,
  currentStatus: InvoiceStatus,
): InvoiceStatus {
  if (totalPaid >= totalAmount) {
    return InvoiceStatus.PAID;
  }

  if (totalPaid > 0n) {
    return InvoiceStatus.PARTIAL_PAID;
  }

  return currentStatus;
}
