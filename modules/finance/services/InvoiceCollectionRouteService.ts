import { randomUUID } from "crypto";
import { Prisma as PrismaBilling } from "@prisma/client-billing";
import { logActivitySafe } from "@/lib/logger";
import { PelangganRepository } from "@/modules/pelanggan/repositories/PelangganRepository";
import { UserRepository } from "@/modules/users/repositories/UserRepository";
import { InvoiceRepository } from "../repositories/InvoiceRepository";

type RouteUser = {
  id: string;
  role?: string | null;
};

type InvoiceListFilters = {
  status?: string | null;
  pelangganId?: string | null;
  page: number;
  limit: number;
  search?: string | null;
};

type InvoiceCreateInput = {
  pelangganId: string;
  siteId?: string | null;
  issueDate?: string | Date;
  dueDate?: string | Date;
  status: string;
  taxAmount: number;
  discountAmount: number;
  notes?: string | null;
  terms?: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    itemType?: string | null;
  }>;
};

type InvoiceCreateResult =
  | { status: "not-found" }
  | { status: "forbidden-user-site" }
  | { status: "forbidden-customer-site" }
  | { status: "created"; data: SerializedCreatedInvoice };

export type InvoiceRouteError =
  | { status: "duplicate-invoice-number" }
  | { status: "foreign-key-error" }
  | { status: "unknown" };

type SerializedCreatedInvoice = {
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  invoiceItem: Array<{
    unitPrice: string;
    totalPrice: string;
  }>;
};

const invoiceRepository = new InvoiceRepository();
const userRepository = new UserRepository();

function getPelangganRepository() {
  return new PelangganRepository();
}

/** Lists invoices for route responses with pagination and site restrictions. */
export async function listInvoicesForRoute(options: {
  filters: InvoiceListFilters;
  user: RouteUser;
  isRestricted: boolean;
}) {
  const where = await buildInvoiceListWhere(options);
  if (!where) {
    return buildEmptyInvoiceList(options.filters);
  }

  const result = await invoiceRepository.findPaginatedWithItemsAndPayments({
    where,
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

/** Creates an invoice for route responses with legacy amount conversion. */
export function mapInvoiceRouteError(error: unknown): InvoiceRouteError {
  if (!(error instanceof PrismaBilling.PrismaClientKnownRequestError)) {
    return { status: "unknown" };
  }

  if (error.code === "P2002") return { status: "duplicate-invoice-number" };
  if (error.code === "P2003") return { status: "foreign-key-error" };

  return { status: "unknown" };
}

export async function createInvoiceForRoute(options: {
  input: InvoiceCreateInput;
  user: RouteUser;
  isRestricted: boolean;
  now?: Date;
}): Promise<InvoiceCreateResult> {
  const pelanggan = await getPelangganRepository().findById(
    options.input.pelangganId,
  );
  if (!pelanggan) {
    return { status: "not-found" };
  }

  const siteResult = await resolveCreateSiteId(options, pelanggan.siteId);
  if (siteResult.status !== "ok") {
    return { status: siteResult.status };
  }

  const now = options.now ?? new Date();
  const invoiceNumber = await buildInvoiceNumber(now);
  const amountResult = buildInvoiceAmounts(options.input.items);
  const taxAmount = toStoredAmount(options.input.taxAmount);
  const discountAmount = toStoredAmount(options.input.discountAmount);
  const totalAmount = amountResult.subtotal + taxAmount - discountAmount;
  const invoice = await invoiceRepository.createWithItems({
    id: randomUUID(),
    invoiceNumber,
    pelangganId: options.input.pelangganId,
    issueDate: new Date(options.input.issueDate),
    dueDate: new Date(options.input.dueDate),
    status: options.input.status,
    subtotal: amountResult.subtotal,
    taxAmount,
    discountAmount,
    totalAmount,
    createdBy: options.user.id,
    updatedAt: new Date(),
    ...(options.input.notes ? { notes: options.input.notes } : {}),
    ...(options.input.terms ? { terms: options.input.terms } : {}),
    ...(siteResult.siteId ? { siteId: siteResult.siteId } : {}),
    invoiceItem: { create: amountResult.items },
  } as PrismaBilling.InvoiceCreateInput);

  logActivitySafe({
    action: "CREATE",
    subject: "Invoice",
    userId: options.user.id,
    details: {
      id: invoice.id,
      number: invoice.invoiceNumber,
      total: Number(totalAmount) / 100,
    },
  });

  return { status: "created", data: serializeCreatedInvoice(invoice) };
}

async function buildInvoiceListWhere(options: {
  filters: InvoiceListFilters;
  user: RouteUser;
  isRestricted: boolean;
}) {
  const where: PrismaBilling.InvoiceWhereInput = {};

  if (options.isRestricted) {
    const siteId = await getRestrictedSiteId(options.user.id);
    if (!siteId) {
      return null;
    }
    where.siteId = siteId;
  }

  if (options.filters.status) {
    where.status = options.filters
      .status as PrismaBilling.InvoiceWhereInput["status"];
  }
  if (options.filters.pelangganId) {
    where.pelangganId = options.filters.pelangganId;
  }
  if (options.filters.search) {
    where.OR = [
      {
        invoiceNumber: {
          contains: options.filters.search,
          mode: "insensitive",
        },
      },
    ];
  }

  return where;
}

function buildEmptyInvoiceList(filters: InvoiceListFilters) {
  return {
    data: [] as unknown[],
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
  };
}

async function resolveCreateSiteId(
  options: {
    input: InvoiceCreateInput;
    user: RouteUser;
    isRestricted: boolean;
  },
  customerSiteId?: string | null,
) {
  if (!options.isRestricted) {
    return {
      status: "ok" as const,
      siteId: options.input.siteId || customerSiteId,
    };
  }

  const userSiteId = await getRestrictedSiteId(options.user.id);
  if (!userSiteId) {
    return { status: "forbidden-user-site" as const };
  }

  if (customerSiteId && customerSiteId !== userSiteId) {
    return { status: "forbidden-customer-site" as const };
  }

  return { status: "ok" as const, siteId: userSiteId };
}

async function getRestrictedSiteId(userId: string) {
  const user = await userRepository.findByIdWithSite(userId);
  return user?.siteId || undefined;
}

async function buildInvoiceNumber(now: Date) {
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const invoiceCount = await invoiceRepository.countByMonth(now);

  return `INV/${currentYear}/${currentMonth}/${String(invoiceCount + 1).padStart(4, "0")}`;
}

function buildInvoiceAmounts(items: InvoiceCreateInput["items"]) {
  let subtotal = 0n;
  const processedItems = items.map((item) => {
    const unitPrice = toStoredAmount(item.unitPrice);
    const totalPrice = BigInt(item.quantity) * unitPrice;
    subtotal += totalPrice;

    return {
      id: randomUUID(),
      description: item.description,
      quantity: item.quantity,
      unitPrice,
      totalPrice,
      itemType: item.itemType,
    };
  });

  return { subtotal, items: processedItems };
}

function toStoredAmount(amount: number) {
  return BigInt(Math.round(amount * 100)) / 100n;
}

function serializeCreatedInvoice(invoice: {
  subtotal: bigint;
  taxAmount: bigint;
  discountAmount: bigint;
  totalAmount: bigint;
  invoiceItem?: Array<{
    unitPrice: bigint;
    totalPrice: bigint;
  }>;
  items?: Array<{
    unitPrice: bigint;
    totalPrice: bigint;
  }>;
}): SerializedCreatedInvoice {
  const items = invoice.invoiceItem ?? invoice.items ?? [];

  return {
    ...invoice,
    subtotal: invoice.subtotal.toString(),
    taxAmount: invoice.taxAmount.toString(),
    discountAmount: invoice.discountAmount.toString(),
    totalAmount: invoice.totalAmount.toString(),
    invoiceItem: items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
      totalPrice: item.totalPrice.toString(),
    })),
  };
}
