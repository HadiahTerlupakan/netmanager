import { InvoiceMapper } from "../../mappers/InvoiceMapper";
import type { InvoiceEntity } from "../../domain/entities/InvoiceEntity";
import type { InvoiceWithPayment } from "../../domain/ports/IInvoiceRepository";

/** Memetakan invoice Prisma menjadi entity domain dasar. */
export function mapInvoiceEntity(invoice: unknown) {
  if (!invoice) {
    return null;
  }

  return InvoiceMapper.toDomain(invoice as never);
}

/** Memetakan invoice Prisma beserta item menjadi entity domain. */
export function mapInvoiceWithItems(invoice: unknown) {
  if (!invoice) {
    return null;
  }

  const source = invoice as Record<string, unknown>;
  return InvoiceMapper.toDomain({
    ...source,
    items: source.invoiceItem,
    payments: [],
  } as never);
}

/** Memetakan invoice Prisma beserta payment menjadi entity domain. */
export function mapInvoiceWithPayment(invoice: unknown) {
  if (!invoice) {
    return null;
  }

  const source = invoice as Record<string, unknown>;
  return InvoiceMapper.toDomain({
    ...source,
    items: [],
    payments: source.payment,
  } as never) as InvoiceWithPayment;
}

/** Memetakan invoice Prisma beserta item dan payment menjadi entity domain. */
export function mapInvoiceWithItemsAndPayments(invoice: unknown) {
  if (!invoice) {
    return null;
  }

  const source = invoice as Record<string, unknown>;
  return InvoiceMapper.toDomain({
    ...source,
    items: source.invoiceItem,
    payments: source.payment,
  } as never) as InvoiceEntity | null;
}
