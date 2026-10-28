import {
  findPaymentMethodByCode,
  findPaymentMethodProvider,
} from "@/modules/payment-gateway";
import { getPelangganBillingBridge } from "../pelanggan-registry";
import {
  PaymentGatewayTransactionRepository,
  type GatewayTransactionQuery,
  type GatewayTransactionRow,
} from "../repositories/PaymentGatewayTransactionRepository";
import { getCustomerNameMap } from "./manual-payment-admin.helpers";

/**
 * Status yang ditampilkan admin. CANCELLED dipecah menurut sebabnya, karena
 * "dibatalkan" saja tidak menjelaskan apakah pelanggan mengganti metode atau
 * tagihannya sudah lunas lewat jalan lain.
 */
export type GatewayDisplayStatus =
  | "MENUNGGU"
  | "LUNAS"
  | "KEDALUWARSA"
  | "GAGAL"
  | "DIGANTI_METODE"
  | "DITUTUP_LUNAS"
  | "DIBATALKAN_ADMIN"
  | "DIBATALKAN";

// Ditulis PaymentCancellationService. Pembatalan admin hanya berlaku untuk
// payment PAID, jadi pada payment gateway artinya dana sudah diterima.
const ADMIN_CANCEL_NOTE = "Cancelled by admin";

export type GatewayTransactionFilter = Omit<
  GatewayTransactionQuery,
  "pelangganIds" | "invoiceNumber"
> & {
  search?: string;
  page: number;
  limit: number;
};

type SummaryEntry = { status: string; count: number; amount: number };

const repository = new PaymentGatewayTransactionRepository();

/** Daftar pembayaran gateway lengkap dengan pelanggan, metode, dan status. */
export async function listPaymentGatewayTransactions(
  filter: GatewayTransactionFilter,
) {
  const query = await resolveQuery(filter);
  const skip = (filter.page - 1) * filter.limit;
  const [rows, total, summary] = await Promise.all([
    repository.findPage(query, skip, filter.limit),
    repository.count(query),
    repository.summarize(query),
  ]);
  const [names, switched] = await Promise.all([
    getCustomerNameMap(
      getPelangganBillingBridge(),
      rows.map((row) => row.pelangganId),
    ),
    findSwitchedPaymentIds(rows),
  ]);

  return {
    items: rows.map((row) =>
      toTransaction(row, names[row.pelangganId], switched),
    ),
    total,
    summary: summary.map<SummaryEntry>((entry) => ({
      status: entry.gatewayStatus ?? "UNKNOWN",
      count: entry._count._all,
      amount: Number(entry._sum.amount ?? 0),
    })),
  };
}

// Pencarian mencocokkan nomor tagihan di database billing atau nama/kode
// pelanggan di database utama.
async function resolveQuery(
  filter: GatewayTransactionFilter,
): Promise<GatewayTransactionQuery> {
  const { search, page: _page, limit: _limit, ...rest } = filter;
  const text = search?.trim();
  if (!text) return rest;
  const pelangganIds = await getPelangganBillingBridge().findIdsBySearch(text);
  return { ...rest, invoiceNumber: text, pelangganIds };
}

/**
 * Checkout CANCELLED yang punya checkout lebih baru untuk invoice yang sama
 * berarti pelanggan mengganti metode.
 */
async function findSwitchedPaymentIds(rows: GatewayTransactionRow[]) {
  const cancelled = rows.filter(
    (row) => row.gatewayStatus === "CANCELLED" && row.invoiceId,
  );
  if (cancelled.length === 0) return new Set<string>();

  const earliest = new Date(
    Math.min(...cancelled.map((row) => row.createdAt.getTime())),
  );
  const later = await repository.findLaterCheckouts(
    cancelled.map((row) => row.invoiceId as string),
    earliest,
  );
  return new Set(
    cancelled
      .filter((row) =>
        later.some(
          (other) =>
            other.invoiceId === row.invoiceId &&
            other.createdAt > row.createdAt &&
            other.checkoutId !== row.checkoutId,
        ),
      )
      .map((row) => row.id),
  );
}

export function resolveDisplayStatus(
  row: Pick<
    GatewayTransactionRow,
    "id" | "gatewayStatus" | "expiresAt" | "notes"
  > & {
    invoice: { status: string } | null;
  },
  switched: Set<string>,
  now = new Date(),
): GatewayDisplayStatus {
  switch (row.gatewayStatus) {
    case "PAID":
      return "LUNAS";
    case "EXPIRED":
      return "KEDALUWARSA";
    case "FAILED":
      return "GAGAL";
    case "CANCELLED":
      if (row.notes?.startsWith(ADMIN_CANCEL_NOTE)) return "DIBATALKAN_ADMIN";
      if (switched.has(row.id)) return "DIGANTI_METODE";
      return row.invoice?.status === "PAID" ? "DITUTUP_LUNAS" : "DIBATALKAN";
    default:
      // Batas waktu lewat tapi sapuan kedaluwarsa belum berjalan.
      return row.expiresAt && row.expiresAt < now ? "KEDALUWARSA" : "MENUNGGU";
  }
}

// gatewayProvider berisi kode channel portal (mis. "BC"); baris lama yang
// ditimpa webhook berisi nama provider (mis. "DUITKU").
function describeMethod(row: GatewayTransactionRow) {
  const code = row.gatewayProvider ?? "";
  const method = code ? findPaymentMethodByCode(code) : null;
  return {
    gateway: method?.provider ?? findPaymentMethodProvider(code) ?? code,
    methodCode: method?.code ?? null,
    methodName: method?.name ?? null,
  };
}

/** ID transaksi di sisi gateway, mis. `BC261EVTS…` pada `topupdirectv2.aspx?ref=`. */
export function gatewayTransactionIdFromUrl(paymentUrl: string | null) {
  if (!paymentUrl) return null;
  try {
    return new URL(paymentUrl).searchParams.get("ref");
  } catch {
    return null;
  }
}

function toTransaction(
  row: GatewayTransactionRow,
  customerName: string | undefined,
  switched: Set<string>,
) {
  return {
    id: row.id,
    checkoutId: row.checkoutId,
    pelangganId: row.pelangganId,
    customerName: customerName ?? null,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoice?.invoiceNumber ?? null,
    invoiceStatus: row.invoice?.status ?? null,
    amount: Number(row.amount),
    discountAmount: Number(row.discountAmount),
    ...describeMethod(row),
    gatewayStatus: row.gatewayStatus,
    status: resolveDisplayStatus(row, switched),
    // Nama kolom mengikuti catatan pembayaran Duitku: No. Order Merchant,
    // No. Referensi, dan PG Transaction ID.
    reference: row.reference,
    transactionId: row.transactionId,
    pgTransactionId: gatewayTransactionIdFromUrl(row.paymentUrl),
    fee: row.gatewayFee === null ? null : Number(row.gatewayFee),
    receivedAmount:
      row.gatewayFee === null
        ? null
        : Number(row.amount) - Number(row.gatewayFee),
    vaNumber: row.vaNumber,
    paymentUrl: row.paymentUrl,
    expiresAt: row.expiresAt,
    paidAt: row.gatewayStatus === "PAID" ? row.paymentDate : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
