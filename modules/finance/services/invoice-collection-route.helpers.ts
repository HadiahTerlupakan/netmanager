import { randomUUID } from "crypto";
import type { Prisma as PrismaBilling } from "@prisma/client-billing";

const CURRENCY_SCALE = 100;
const DEFAULT_ZERO_BIGINT = 0n;

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

/** Membuat payload list kosong untuk route invoice. */
export function buildEmptyInvoiceList(filters: InvoiceListFilters) {
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

/** Menambahkan status filter ke where invoice. */
export function applyInvoiceStatusFilter(
  where: PrismaBilling.InvoiceWhereInput,
  status?: string | null,
) {
  if (!status) {
    return;
  }

  where.status = status as PrismaBilling.InvoiceWhereInput["status"];
}

/** Menambahkan pelanggan filter ke where invoice. */
export function applyInvoiceCustomerFilter(
  where: PrismaBilling.InvoiceWhereInput,
  pelangganId?: string | null,
) {
  if (pelangganId) {
    where.pelangganId = pelangganId;
  }
}

/** Menambahkan pencarian invoice number ke where invoice. */
export function applyInvoiceSearchFilter(
  where: PrismaBilling.InvoiceWhereInput,
  search?: string | null,
) {
  if (!search) {
    return;
  }

  where.OR = [
    {
      invoiceNumber: {
        contains: search,
        mode: "insensitive",
      },
    },
  ];
}

/** Membangun invoice number baru berdasarkan waktu dan urutan bulanan. */
export function formatInvoiceNumber(now: Date, invoiceCount: number) {
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const sequence = String(invoiceCount + 1).padStart(4, "0");
  return `INV/${currentYear}/${currentMonth}/${sequence}`;
}

/** Mengonversi nominal route ke format bigint tersimpan. */
export function toStoredAmount(amount: number) {
  return BigInt(Math.round(amount * CURRENCY_SCALE)) / BigInt(CURRENCY_SCALE);
}

/** Menghitung subtotal dan item invoice yang akan disimpan. */
export function buildInvoiceAmounts(items: InvoiceCreateInput["items"]) {
  let subtotal = DEFAULT_ZERO_BIGINT;
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

/** Menyerialisasi invoice baru ke bentuk respons route. */
export function serializeCreatedInvoice(invoice: {
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
  return {
    ...invoice,
    subtotal: invoice.subtotal.toString(),
    taxAmount: invoice.taxAmount.toString(),
    discountAmount: invoice.discountAmount.toString(),
    totalAmount: invoice.totalAmount.toString(),
    invoiceItem: getSerializedInvoiceItems(invoice),
  };
}

function getSerializedInvoiceItems(invoice: {
  invoiceItem?: Array<{ unitPrice: bigint; totalPrice: bigint }>;
  items?: Array<{ unitPrice: bigint; totalPrice: bigint }>;
}) {
  const items = invoice.invoiceItem ?? invoice.items ?? [];
  return items.map((item) => ({
    ...item,
    unitPrice: item.unitPrice.toString(),
    totalPrice: item.totalPrice.toString(),
  }));
}
