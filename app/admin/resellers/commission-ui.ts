import { RESELLER_LIST_URL } from "./useResellerList";

/** Zona tanggal kalender aturan komisi (WIB). */
const WIB_OFFSET = "+07:00";

export type CommissionRuleType = "PERCENTAGE" | "FIXED";
export type CommissionRuleStatus = "ACTIVE" | "INACTIVE";
export type SettlementStatus = "PENDING" | "APPROVED" | "PAID";
export type SettlementPaymentMethod =
  | "BANK_TRANSFER"
  | "CASH"
  | "E_WALLET"
  | "OTHER";

export type CommissionRule = {
  readonly id: string;
  readonly hargaPaketId: string | null;
  readonly hargaPaketName: string | null;
  readonly type: CommissionRuleType;
  readonly rate: number | null;
  readonly fixedAmount: number | null;
  readonly status: CommissionRuleStatus;
  readonly startsAt: string;
  readonly endsAt: string | null;
};

export type Settlement = {
  readonly id: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly totalAmount: number;
  readonly commissionCount: number;
  readonly status: SettlementStatus;
  readonly approvedAt: string | null;
  readonly paidAt: string | null;
  readonly paymentMethod: string | null;
  readonly paymentReference: string | null;
};

export type ReportFigures = {
  readonly activeCustomers: number;
  readonly grossBilled: number;
  readonly paid: number;
  readonly commissionAccrued: number;
  readonly commissionSettled: number;
  readonly commissionPaid: number;
};

export type ReportRow = ReportFigures & {
  readonly outletId: string | null;
  readonly outletCode: string | null;
  readonly outletName: string;
};

export type MonthlyReport = {
  readonly period: string;
  readonly rows: readonly ReportRow[];
  readonly totals: ReportFigures;
};

export type RuleForm = {
  readonly type: CommissionRuleType;
  readonly value: string;
  readonly hargaPaketId: string;
  readonly startsAt: string;
  readonly endsAt: string;
};

export type PaymentForm = {
  readonly paidAt: string;
  readonly paymentMethod: SettlementPaymentMethod;
  readonly paymentReference: string;
  readonly accountId: string;
};

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  PENDING: "Menunggu persetujuan",
  APPROVED: "Disetujui",
  PAID: "Dibayar",
};

export const PAYMENT_METHOD_LABELS: Record<SettlementPaymentMethod, string> = {
  BANK_TRANSFER: "Transfer bank",
  CASH: "Tunai",
  E_WALLET: "Dompet digital",
  OTHER: "Lainnya",
};

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
/** Tanggal aturan komisi disimpan sebagai batas hari kalender WIB. */
const ruleDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

/** Rupiah tanpa desimal, mis. "Rp 10.000". */
export function formatRupiah(amount: number): string {
  return rupiahFormatter.format(amount);
}

/** Tanggal ISO menjadi "1 Okt 2026" (UTC, sama dengan periode komisi). */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** "10%" atau "Rp 5.000 / invoice". */
export function describeRuleValue(rule: CommissionRule): string {
  return rule.type === "PERCENTAGE"
    ? `${rule.rate ?? 0}% dari DPP`
    : `${formatRupiah(rule.fixedAmount ?? 0)} / invoice`;
}

/** "Mulai 1 Okt 2026" atau "1 Okt 2026 – 31 Des 2026". */
export function describeRulePeriod(rule: CommissionRule): string {
  const start = ruleDateFormatter.format(new Date(rule.startsAt));
  return rule.endsAt
    ? `${start} – ${ruleDateFormatter.format(new Date(rule.endsAt))}`
    : `Mulai ${start}`;
}

/** Bulan berjalan `YYYY-MM` (UTC). */
export function currentPeriod(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** Tanggal hari ini `YYYY-MM-DD` untuk input date. */
export function todayInputValue(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Payload API aturan komisi dari form; null bila nilainya bukan bilangan
 * bulat positif (validasi rinci tetap di server). Tanggal form adalah tanggal
 * kalender WIB: berlaku sejak 00:00 WIB tanggal mulai sampai 23:59:59 WIB
 * tanggal akhir. Tanggal polos akan dibaca sebagai tengah malam UTC (07:00
 * WIB), sehingga pelunasan dini hari tanggal mulai tidak mendapat aturan.
 */
export function buildRulePayload(
  form: RuleForm,
): Record<string, unknown> | null {
  const value = Number(form.value);
  if (!Number.isInteger(value) || value <= 0) return null;
  return {
    type: form.type,
    ...(form.type === "PERCENTAGE" ? { rate: value } : { fixedAmount: value }),
    hargaPaketId: form.hargaPaketId || null,
    ...(form.startsAt
      ? { startsAt: `${form.startsAt}T00:00:00${WIB_OFFSET}` }
      : {}),
    endsAt: form.endsAt ? `${form.endsAt}T23:59:59.999${WIB_OFFSET}` : null,
  };
}

/** Aksi berikutnya yang tersedia untuk settlement. */
export function nextSettlementAction(
  status: SettlementStatus,
): "approve" | "pay" | null {
  if (status === "PENDING") return "approve";
  if (status === "APPROVED") return "pay";
  return null;
}

/** URL API per reseller. */
export function resellerApiUrl(resellerId: string, path: string): string {
  return `${RESELLER_LIST_URL}/${resellerId}/${path}`;
}

/** URL laporan bulanan; `csv` untuk unduhan. */
export function buildReportUrl(
  resellerId: string,
  period: string,
  format: "json" | "csv" = "json",
): string {
  const query = new URLSearchParams({ period });
  if (format === "csv") query.set("format", "csv");
  return resellerApiUrl(resellerId, `report?${query.toString()}`);
}
