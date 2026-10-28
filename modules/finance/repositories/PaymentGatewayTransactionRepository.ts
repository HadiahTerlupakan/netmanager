import { prismaBilling } from "@/lib/prisma-billing";
import type { Prisma } from "@prisma/client-billing";

/**
 * Payment yang dibuat lewat payment gateway. Transfer manual tidak punya
 * expiresAt maupun gatewayProvider.
 */
const GATEWAY_PAYMENT: Prisma.PaymentWhereInput = {
  OR: [{ expiresAt: { not: null } }, { gatewayProvider: { not: null } }],
};

export const GATEWAY_TRANSACTION_SELECT = {
  id: true,
  pelangganId: true,
  invoiceId: true,
  checkoutId: true,
  amount: true,
  discountAmount: true,
  reference: true,
  transactionId: true,
  gatewayStatus: true,
  gatewayProvider: true,
  paymentMethod: true,
  vaNumber: true,
  paymentUrl: true,
  gatewayFee: true,
  notes: true,
  expiresAt: true,
  paymentDate: true,
  createdAt: true,
  updatedAt: true,
  invoice: { select: { invoiceNumber: true, status: true } },
} as const;

export type GatewayTransactionRow = Prisma.PaymentGetPayload<{
  select: typeof GATEWAY_TRANSACTION_SELECT;
}>;

export type GatewayTransactionQuery = {
  status?: string;
  method?: string;
  from?: Date;
  to?: Date;
  invoiceId?: string;
  invoiceNumber?: string;
  pelangganIds?: string[];
};

function buildWhere(
  query: GatewayTransactionQuery,
  withStatus: boolean,
): Prisma.PaymentWhereInput {
  const and: Prisma.PaymentWhereInput[] = [GATEWAY_PAYMENT];
  if (withStatus && query.status) {
    and.push({ gatewayStatus: query.status as never });
  }
  if (query.method) and.push({ gatewayProvider: query.method });
  if (query.invoiceId) and.push({ invoiceId: query.invoiceId });
  if (query.from || query.to) {
    and.push({ createdAt: { gte: query.from, lte: query.to } });
  }
  const search: Prisma.PaymentWhereInput[] = [];
  if (query.invoiceNumber) {
    search.push({
      invoice: {
        invoiceNumber: { contains: query.invoiceNumber, mode: "insensitive" },
      },
    });
  }
  if (query.pelangganIds) {
    search.push({ pelangganId: { in: query.pelangganIds } });
  }
  if (search.length > 0) and.push({ OR: search });
  return { AND: and };
}

/** Akses data pembayaran gateway untuk halaman pemantauan admin. */
export class PaymentGatewayTransactionRepository {
  findPage(query: GatewayTransactionQuery, skip: number, take: number) {
    return prismaBilling.payment.findMany({
      where: buildWhere(query, true),
      select: GATEWAY_TRANSACTION_SELECT,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
  }

  count(query: GatewayTransactionQuery) {
    return prismaBilling.payment.count({ where: buildWhere(query, true) });
  }

  /** Jumlah dan nominal per status gateway, tanpa filter status. */
  summarize(query: GatewayTransactionQuery) {
    return prismaBilling.payment.groupBy({
      by: ["gatewayStatus"],
      where: buildWhere(query, false),
      _count: { _all: true },
      _sum: { amount: true },
    });
  }

  /** Checkout yang dibuat setelah tanggal tertentu untuk invoice-invoice ini. */
  findLaterCheckouts(invoiceIds: string[], after: Date) {
    return prismaBilling.payment.findMany({
      where: {
        AND: [
          GATEWAY_PAYMENT,
          { invoiceId: { in: invoiceIds }, createdAt: { gt: after } },
        ],
      },
      select: { invoiceId: true, checkoutId: true, createdAt: true },
    });
  }
}
