import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import type { PelangganBillingBridgeService } from "@/modules/pelanggan";
import type { PaymentEntity } from "../domain/entities/PaymentEntity";
import type {
  PaymentWhereInput,
  GatewayPaymentStatus,
} from "../types/payment.types";

export type PendingManualPaymentsInput = {
  startDate?: string | null;
  endDate?: string | null;
  /** Site yang diminta lewat filter layar. */
  siteId?: string | null;
  status?: string | null;
  /**
   * Seluruh site admin bila dibatasi (`resolveManualPaymentAllowedSiteIds`),
   * `undefined` bila tidak. Daftar kosong = dibatasi tanpa site → kosong.
   */
  allowedSiteIds?: readonly string[];
};

type PaymentRecord = PaymentEntity & {
  checkoutId?: string | null;
  invoice?: (PaymentEntity["invoice"] & { totalAmount: bigint }) | null;
};

/** Jumlah transfer dan tagihan yang dicakup satu checkout transfer. */
export type CheckoutSummary = { total: bigint; invoiceNumbers: string[] };

type CheckoutPaymentRow = {
  checkoutId: string | null;
  amount: bigint;
  invoice: { invoiceNumber: string; dueDate: Date } | null;
};

const SETTLED_INVOICE_WARNINGS: Record<string, string> = {
  PAID: "Tagihan sudah lunas — menyetujui akan dikreditkan ke saldo",
  CANCELLED:
    "Tagihan sudah dibatalkan — menyetujui akan dialihkan ke tagihan pengganti atau saldo",
};

const MAX_PENDING_MANUAL_PAYMENTS = 500;
const EMPTY_SCOPE: string[] = [];
const REJECTED_GATEWAY_STATUSES: GatewayPaymentStatus[] = [
  "FAILED",
  "CANCELLED",
];

export function buildPendingManualPaymentsWhere(
  input: PendingManualPaymentsInput,
): PaymentWhereInput {
  const where: PaymentWhereInput = { receiptUrl: { not: null } };

  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    start.setTime(toStartOfDay(start).getTime());
    const end = new Date(input.endDate);
    end.setTime(toEndOfDay(end).getTime());
    where.createdAt = { gte: start, lte: end };
  }

  const gatewayStatus = mapGatewayStatusFilter(input.status);
  if (gatewayStatus) {
    where.gatewayStatus = gatewayStatus;
  }

  return where;
}

export function limitPendingManualPayments<T extends { createdAt: Date }>(
  payments: T[],
) {
  return payments
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, MAX_PENDING_MANUAL_PAYMENTS);
}

export function serializeManualPayment(
  payment: PaymentRecord,
  customerName: string,
  checkout?: CheckoutSummary,
) {
  return {
    ...payment,
    amount: payment.amount.toString(),
    invoice: payment.invoice
      ? {
          ...payment.invoice,
          totalAmount: payment.invoice.totalAmount.toString(),
        }
      : null,
    customerName,
    // Bukti satu checkout menutup semua tagihannya; admin mencocokkan nominal
    // struk dengan total ini, bukan dengan bagian satu tagihan.
    checkoutTotal: (checkout?.total ?? payment.amount).toString(),
    checkoutInvoiceNumbers:
      checkout?.invoiceNumbers ??
      (payment.invoice?.invoiceNumber ? [payment.invoice.invoiceNumber] : []),
    settlementWarning: describeSettlementWarning(payment),
  };
}

/**
 * Bukti yang masih menunggu untuk tagihan yang sudah lunas atau dibatalkan
 * lewat jalur lain: menyetujuinya tidak melunasi tagihan itu lagi.
 */
function describeSettlementWarning(payment: PaymentRecord): string | null {
  if (payment.gatewayStatus !== "PENDING") return null;
  return SETTLED_INVOICE_WARNINGS[payment.invoice?.status ?? ""] ?? null;
}

/** Total dan nomor tagihan (urut jatuh tempo) per checkout. */
export function summarizeCheckouts(
  rows: CheckoutPaymentRow[],
): Map<string, CheckoutSummary> {
  const byCheckout = new Map<string, CheckoutPaymentRow[]>();
  for (const row of rows) {
    if (!row.checkoutId) continue;
    byCheckout.set(row.checkoutId, [
      ...(byCheckout.get(row.checkoutId) ?? []),
      row,
    ]);
  }
  return new Map(
    [...byCheckout].map(([checkoutId, group]) => [
      checkoutId,
      {
        total: group.reduce((sum, row) => sum + row.amount, 0n),
        invoiceNumbers: group
          .flatMap((row) => (row.invoice ? [row.invoice] : []))
          .sort(
            (left, right) => left.dueDate.getTime() - right.dueDate.getTime(),
          )
          .map((invoice) => invoice.invoiceNumber),
      },
    ]),
  );
}

/**
 * Pelanggan yang pembayarannya boleh tampil, atau `null` bila tanpa batas.
 * Admin terbatas melihat pelanggan SELURUH site-nya; site yang diminta hanya
 * dipakai bila termasuk site tersebut (permintaan di luar lingkup diabaikan).
 */
export async function getScopedPelangganIds(
  pelangganRepository: PelangganBillingBridgeService,
  requestedSiteId?: string | null,
  allowedSiteIds?: readonly string[],
) {
  const siteIds = resolvePendingSiteIds(requestedSiteId, allowedSiteIds);
  if (siteIds === null) return null;
  if (siteIds.length === 0) return EMPTY_SCOPE;

  const pelanggansPerSite = await Promise.all(
    siteIds.map((siteId) => pelangganRepository.findBySiteId(siteId)),
  );
  return pelanggansPerSite.flat().map((pelanggan) => pelanggan.id);
}

function resolvePendingSiteIds(
  requestedSiteId?: string | null,
  allowedSiteIds?: readonly string[],
): readonly string[] | null {
  if (!allowedSiteIds) return requestedSiteId ? [requestedSiteId] : null;
  if (requestedSiteId && allowedSiteIds.includes(requestedSiteId)) {
    return [requestedSiteId];
  }
  return allowedSiteIds;
}

type CustomerNameRecord = {
  id: string;
  nama: string;
};

export async function getCustomerNameMap(
  pelangganRepository: PelangganBillingBridgeService,
  pelangganIds: string[],
) {
  if (pelangganIds.length === 0) {
    return {} as Record<string, string>;
  }

  const uniqueIds = Array.from(new Set(pelangganIds));
  const customers = (await pelangganRepository.findManyByIds(
    uniqueIds,
  )) as Array<CustomerNameRecord>;

  return customers.reduce<Record<string, string>>((nameMap, customer) => {
    nameMap[customer.id] = customer.nama;
    return nameMap;
  }, {});
}

function mapGatewayStatusFilter(
  status?: string | null,
): PaymentWhereInput["gatewayStatus"] {
  if (status === "PENDING") {
    return "PENDING";
  }

  if (status === "APPROVED") {
    return "PAID";
  }

  if (status === "REJECTED") {
    return { in: REJECTED_GATEWAY_STATUSES };
  }

  return undefined;
}
