import { prismaBillingAuth } from "@/lib/prisma-billing";

/** Payment yang uangnya sudah diterima untuk tagihan yang diperiksa ulang. */
export type ReceivedInvoicePayment = {
  id: string;
  invoiceId: string | null;
  pelangganId: string;
  tenantId: string | null;
  amount: bigint;
  discountAmount: bigint;
  gatewayStatus: string | null;
  paymentDate: Date;
};

/** Tagihan beserta nominal terbayarnya dan payment yang sudah diterima. */
export type InvoiceWithReceivedPayments = {
  id: string;
  paidAmount: bigint;
  payment: ReceivedInvoicePayment[];
};

/**
 * Tagihan yang tidak dibatalkan dan menerima payment PAID di antara `from`
 * dan `to`, masing-masing dengan semua payment yang uangnya sudah diterima
 * (PAID, atau manual tanpa status gateway). Lintas tenant, untuk cron.
 */
export async function findInvoicesWithPaidPaymentsBetween(
  from: Date,
  to: Date,
): Promise<InvoiceWithReceivedPayments[]> {
  const recent = await prismaBillingAuth.payment.findMany({
    where: {
      gatewayStatus: "PAID",
      paymentDate: { gte: from, lte: to },
      invoiceId: { not: null },
    },
    distinct: ["invoiceId"],
    select: { invoiceId: true },
  });
  if (recent.length === 0) return [];

  return prismaBillingAuth.invoice.findMany({
    where: {
      id: { in: recent.flatMap((p) => (p.invoiceId ? [p.invoiceId] : [])) },
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      paidAmount: true,
      payment: {
        where: { OR: [{ gatewayStatus: "PAID" }, { gatewayStatus: null }] },
        select: {
          id: true,
          invoiceId: true,
          pelangganId: true,
          tenantId: true,
          amount: true,
          discountAmount: true,
          gatewayStatus: true,
          paymentDate: true,
        },
      },
    },
  });
}
