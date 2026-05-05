import { randomUUID } from "crypto";
import { Prisma as PrismaBilling } from "../lib/billing-prisma-boundary";
import { logActivitySafe } from "@/lib/logger";
import { PelangganAdminQueryService } from "@/modules/pelanggan";
import { UserLookupService } from "@/modules/users";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import {
  applyInvoiceCustomerFilter,
  applyInvoiceSearchFilter,
  applyInvoiceStatusFilter,
  buildEmptyInvoiceList,
  buildInvoiceAmounts,
  formatInvoiceNumber,
  serializeCreatedInvoice,
  toStoredAmount,
} from "./invoice-collection-route.helpers";

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

let invoiceRepository: InvoiceRepository | null = null;
let userLookupService: UserLookupService | null = null;
let pelangganAdminQueryService: PelangganAdminQueryService | null = null;

function getInvoiceRepository() {
  invoiceRepository ??= new InvoiceRepository();
  return invoiceRepository;
}

function getUserLookupService() {
  userLookupService ??= new UserLookupService();
  return userLookupService;
}

function getPelangganAdminQueryService() {
  pelangganAdminQueryService ??= new PelangganAdminQueryService();
  return pelangganAdminQueryService;
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
  return fetchPaginatedInvoices(options.filters, where);
}

async function fetchPaginatedInvoices(
  filters: InvoiceListFilters,
  where: PrismaBilling.InvoiceWhereInput,
) {
  const result = await getInvoiceRepository().findPaginatedWithItemsAndPayments(
    {
      where,
      page: filters.page,
      limit: filters.limit,
    },
  );
  return {
    data: result.data,
    pagination: buildPaginationMeta(filters, result.total),
  };
}

function buildPaginationMeta(
  filters: { page: number; limit: number },
  total: number,
) {
  const totalPages = Math.ceil(total / filters.limit);
  return {
    page: filters.page,
    limit: filters.limit,
    total,
    totalPages,
    hasNext: filters.page < totalPages,
    hasPrev: filters.page > 1,
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
  const siteResult = await validateCreateInvoicePrerequisites(options);
  if (siteResult.status !== "ok") {
    return { status: siteResult.status };
  }

  const invoice = await createInvoiceRecord(options, siteResult.siteId);
  logCreatedInvoiceActivity(invoice, options.user.id);
  return { status: "created", data: serializeCreatedInvoice(invoice) };
}

async function validateCreateInvoicePrerequisites(options: {
  input: InvoiceCreateInput;
  user: RouteUser;
  isRestricted: boolean;
}) {
  const pelanggan = await getPelangganAdminQueryService().getPppMutationContext(
    options.input.pelangganId,
  );
  if (!pelanggan) {
    return { status: "not-found" as const };
  }
  return resolveCreateSiteId(options, pelanggan.siteId);
}

/** Creates the persisted invoice record with calculated totals. */
async function createInvoiceRecord(
  options: {
    input: InvoiceCreateInput;
    user: RouteUser;
    isRestricted: boolean;
    now?: Date;
  },
  siteId?: string,
) {
  const now = options.now ?? new Date();
  const invoiceNumber = await buildInvoiceNumber(now);
  const amountResult = buildInvoiceAmounts(options.input.items);
  const taxAmount = toStoredAmount(options.input.taxAmount);
  const discountAmount = toStoredAmount(options.input.discountAmount);
  const totalAmount = amountResult.subtotal + taxAmount - discountAmount;

  return getInvoiceRepository().createWithItems({
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
    ...(siteId ? { siteId } : {}),
    invoiceItem: { create: amountResult.items },
  } as PrismaBilling.InvoiceCreateInput);
}

/** Logs the create-invoice route activity using legacy amount formatting. */
function logCreatedInvoiceActivity(
  invoice: { id: string; invoiceNumber?: string | null; totalAmount: bigint },
  userId: string,
) {
  logActivitySafe({
    action: "CREATE",
    subject: "Invoice",
    userId,
    details: {
      id: invoice.id,
      number: invoice.invoiceNumber ?? invoice.id,
      total: Number(invoice.totalAmount) / 100,
    },
  });
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

  applyInvoiceStatusFilter(where, options.filters.status);
  applyInvoiceCustomerFilter(where, options.filters.pelangganId);
  applyInvoiceSearchFilter(where, options.filters.search);
  return where;
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
  const user = await getUserLookupService().findByIdWithSite(userId);
  return user?.siteId || undefined;
}

async function buildInvoiceNumber(now: Date) {
  const invoiceCount = await getInvoiceRepository().countByMonth(now);
  return formatInvoiceNumber(now, invoiceCount);
}
