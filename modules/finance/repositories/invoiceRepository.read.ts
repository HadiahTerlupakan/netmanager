import { prismaBilling, prismaBillingAuth } from "@/lib/prisma-billing";
import type { Prisma } from "@prisma/client-billing";
import type { InvoiceEntity } from "../domain/entities/InvoiceEntity";
import type { InvoiceWithPayment } from "../domain/ports/IInvoiceRepository";
import {
  mapInvoiceEntity,
  mapInvoiceWithItems,
  mapInvoiceWithItemsAndPayments,
  mapInvoiceWithPayment,
} from "./shared/invoiceRepositoryMappers";

const INVOICE_WITH_PAYMENT_INCLUDE = {
  payment: true,
} satisfies Prisma.InvoiceInclude;

const INVOICE_WITH_ITEMS_INCLUDE = {
  invoiceItem: true,
} satisfies Prisma.InvoiceInclude;

const INVOICE_WITH_ITEMS_AND_PAYMENTS_INCLUDE = {
  invoiceItem: true,
  payment: true,
} satisfies Prisma.InvoiceInclude;

type PaginatedInvoiceOptions = {
  where: Prisma.InvoiceWhereInput;
  page: number;
  limit: number;
};

export async function findInvoiceWithPaymentEntity(
  id: string,
): Promise<InvoiceWithPayment | null> {
  const invoice = await prismaBilling.invoice.findUnique({
    where: { id },
    include: INVOICE_WITH_PAYMENT_INCLUDE,
  });

  return mapInvoiceWithPayment(invoice);
}

export async function findInvoiceEntityById(
  id: string,
): Promise<InvoiceEntity | null> {
  const invoice = await prismaBilling.invoice.findUnique({ where: { id } });
  return mapInvoiceEntity(invoice);
}

export async function findInvoiceWithItemsAndPaymentsEntity(
  id: string,
): Promise<InvoiceEntity | null> {
  const invoice = await prismaBilling.invoice.findUnique({
    where: { id },
    include: INVOICE_WITH_ITEMS_AND_PAYMENTS_INCLUDE,
  });

  return mapInvoiceWithItemsAndPayments(invoice);
}

export async function findInvoiceWithItemsEntity(
  id: string,
): Promise<InvoiceEntity | null> {
  const invoice = await prismaBilling.invoice.findUnique({
    where: { id },
    include: INVOICE_WITH_ITEMS_INCLUDE,
  });

  return mapInvoiceWithItems(invoice);
}

export async function findInvoiceWithItemsAndPaymentsBySiteEntity(
  id: string,
  siteId: string,
): Promise<InvoiceEntity | null> {
  const invoice = await prismaBilling.invoice.findFirst({
    where: { id, siteId },
    include: INVOICE_WITH_ITEMS_AND_PAYMENTS_INCLUDE,
  });

  return mapInvoiceWithItemsAndPayments(invoice);
}

export async function findPaginatedInvoicesWithItemsAndPayments(
  options: PaginatedInvoiceOptions,
): Promise<{ data: InvoiceEntity[]; total: number }> {
  const skip = (options.page - 1) * options.limit;
  const [data, total] = await Promise.all([
    prismaBilling.invoice.findMany({
      where: options.where,
      include: INVOICE_WITH_ITEMS_AND_PAYMENTS_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: options.limit,
    }),
    prismaBilling.invoice.count({ where: options.where }),
  ]);

  return {
    data: data.map(
      (invoice) => mapInvoiceWithItemsAndPayments(invoice) as InvoiceEntity,
    ),
    total,
  };
}

export async function findInvoiceEntitiesForExactDueDate(
  pelangganId: string,
  dueDateStart: Date,
  dueDateEnd: Date,
): Promise<InvoiceEntity[]> {
  const invoices = await prismaBilling.invoice.findMany({
    where: {
      pelangganId,
      dueDate: { gte: dueDateStart, lte: dueDateEnd },
    },
  });

  return invoices.map((invoice) => mapInvoiceEntity(invoice) as InvoiceEntity);
}

export async function findOverdueInvoiceEntities(
  beforeDate: Date,
): Promise<InvoiceEntity[]> {
  const invoices = await prismaBilling.invoice.findMany({
    where: {
      status: "OVERDUE",
      dueDate: { lt: beforeDate },
    },
  });

  return invoices.map((invoice) => mapInvoiceEntity(invoice) as InvoiceEntity);
}

export async function findAuthInvoiceWithPaymentEntity(
  id: string,
): Promise<InvoiceWithPayment | null> {
  const invoice = await prismaBillingAuth.invoice.findUnique({
    where: { id },
    include: INVOICE_WITH_PAYMENT_INCLUDE,
  });

  return mapInvoiceWithPayment(invoice);
}

export async function findAuthInvoiceEntity(
  id: string,
): Promise<InvoiceEntity | null> {
  const invoice = await prismaBillingAuth.invoice.findUnique({ where: { id } });
  return mapInvoiceEntity(invoice);
}
