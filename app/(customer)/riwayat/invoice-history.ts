import { isOutstandingInvoiceStatus } from "@/lib/constants/invoice-status";
import { isManualTransfer, type LastPayment } from "../tagihan/checkout";

export type HistoryFilter = "ALL" | "SUCCESS" | "PENDING" | "FAILED";

export interface HistoryInvoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  discountAmount?: number;
  paidAmount?: number;
  remainingAmount: number;
  status: string;
  items: Array<{ description: string }>;
  issueDate: string;
  dueDate: string;
  lastPayment?: LastPayment | null;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Tunai",
  BANK_TRANSFER: "Transfer bank",
  E_WALLET: "E-wallet",
  CREDIT_CARD: "Kartu kredit",
  DEBIT_CARD: "Kartu debit",
  CHECK: "Cek",
};
const OTHER_PAYMENT_METHOD_LABEL = "Lainnya";
const GATEWAY_PAYMENT_METHOD_LABEL = "Pembayaran online";
const MANUAL_TRANSFER_LABEL = "Transfer bank manual";

function matchesStatusFilter(status: string, filter: HistoryFilter) {
  if (filter === "SUCCESS") return status === "PAID";
  if (filter === "PENDING") return isOutstandingInvoiceStatus(status);
  // Enum InvoiceStatus tidak punya VOID; tagihan yang batal berstatus CANCELLED.
  if (filter === "FAILED") return status === "CANCELLED";
  return true;
}

function matchesKeyword(invoice: HistoryInvoice, keyword: string) {
  if (!keyword) return true;
  return [
    invoice.invoiceNumber,
    ...invoice.items.map((item) => item.description),
  ].some((text) => text.toLowerCase().includes(keyword));
}

/** Tagihan yang lolos chip status dan kata kunci (nomor tagihan atau keterangan). */
export function filterHistory(
  invoices: HistoryInvoice[],
  filter: HistoryFilter,
  query: string,
) {
  const keyword = query.trim().toLowerCase();
  return invoices.filter(
    (invoice) =>
      matchesStatusFilter(invoice.status, filter) &&
      matchesKeyword(invoice, keyword),
  );
}

/** Dikelompokkan per bulan terbit, sesuai urutan dari server. */
export function groupByIssueMonth(invoices: HistoryInvoice[]) {
  return invoices.reduce<Record<string, HistoryInvoice[]>>((groups, inv) => {
    const month = new Date(inv.issueDate).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
    (groups[month] ??= []).push(inv);
    return groups;
  }, {});
}

function getPaymentMethodLabel(payment: LastPayment) {
  if (isManualTransfer(payment)) return MANUAL_TRANSFER_LABEL;
  // Kode kanal gateway (mis. "BC") tidak bermakna bagi pelanggan.
  if (payment.gatewayProvider) return GATEWAY_PAYMENT_METHOD_LABEL;
  return PAYMENT_METHOD_LABELS[payment.method] ?? OTHER_PAYMENT_METHOD_LABEL;
}

/**
 * Tanggal dan metode pelunasan dari payment terakhir. Checkout yang masih
 * menunggu atau gagal bukan pelunasan, jadi tidak disebut.
 */
export function getPaymentInfo(invoice: HistoryInvoice) {
  const payment = invoice.lastPayment;
  const isPaidInvoice =
    invoice.status === "PAID" || invoice.status === "PARTIAL_PAID";
  const isSettled = !payment?.gatewayStatus || payment.gatewayStatus === "PAID";
  if (!payment || !isPaidInvoice || !isSettled) return null;
  return { date: payment.date, method: getPaymentMethodLabel(payment) };
}

/** Tanggal pendek untuk pelanggan, mis. "12 Okt 2026". */
export function formatDay(dateString: string) {
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
