import { randomUUID } from "crypto";
import {
  GatewayPaymentStatus,
  InvoiceStatus,
  PaymentMethod,
  Prisma as PrismaBilling,
} from "@prisma/client-billing";
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

const invoiceRepository = new InvoiceRepository();
const paymentRepository = new PaymentRepository();

function getPelangganLookupService() {
  return getPelangganService();
}

/** Lists payments for route responses with pagination. */
export async function listPaymentsForRoute(options: {
  filters: PaymentListFilters;
}) {
  const result = await paymentRepository.findPaginatedWithInvoice({
    where: buildPaymentWhere(options.filters),
    page: options.filters.page,
    limit: options.filters.limit,
  });
  const totalPages = Math.ceil(result.total / options.filters.limit);

  return {
    data: result.data,
    pagination: {
      page: options.filters.page,
      limit: options.filters.limit,
      total: result.total,
      totalPages,
      hasNext: options.filters.page < totalPages,
      hasPrev: options.filters.page > 1,
    },
  };
}

/** Creates a payment and updates linked invoice totals when needed. */
export async function getPaymentForRoute(options: {
  paymentId: string;
  user?: PaymentAccessUser;
}) {
  const payment = await paymentRepository.findByIdWithInvoice(
    options.paymentId,
  );
  if (!payment) {
    return { status: "not-found" as const };
  }

  if (!options.user || options.user.isSuperAdmin) {
    return { status: "ok" as const, data: payment };
  }

  const paymentSiteId = payment.invoice?.siteId;
  const paymentTenantId = payment.tenantId;

  if (paymentSiteId && paymentSiteId !== options.user.siteId) {
    return { status: "forbidden-site" as const };
  }

  if (
    !paymentSiteId &&
    paymentTenantId &&
    paymentTenantId !== options.user.tenantId
  ) {
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

  if (options.input.invoiceId) {
    const invoice = await invoiceRepository.findRawById(
      options.input.invoiceId,
    );
    if (!invoice) {
      return { status: "invoice-not-found" };
    }
  }

  const amount = BigInt(Math.round(options.input.amount));
  const payment = await paymentRepository.createWithInvoice({
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
    amount,
    verifiedBy: options.user.id,
    updatedAt: new Date(),
  });

  if (options.input.invoiceId) {
    await updateLinkedInvoicePaymentStatus(options.input.invoiceId);
  }

  logActivitySafe({
    action: "CREATE",
    subject: "Payment",
    userId: options.user.id,
    details: {
      id: payment.id,
      amount: Number(amount),
      method: options.input.paymentMethod,
    },
  });

  return { status: "created", data: payment };
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
  const invoice = await invoiceRepository.findWithPayment(invoiceId);
  if (!invoice) {
    return;
  }

  const totalPaid = invoice.payment.reduce(
    (sum, payment) => sum + payment.amount,
    0n,
  );
  await invoiceRepository.updatePaymentStatus(invoiceId, {
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
