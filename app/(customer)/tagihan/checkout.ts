import { isOutstandingInvoiceStatus } from "@/lib/constants/invoice-status";

export interface PaymentMethod {
  id: string;
  name: string;
  provider: string;
  type: string;
  code: string;
  group: string;
  details?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
}

export interface LastPayment {
  id?: string;
  amount: number;
  date: string;
  method: string;
  accountId?: string | null;
  gatewayStatus?: string | null;
  expiresAt?: string | null;
  paymentUrl?: string | null;
  vaNumber?: string | null;
  qrString?: string | null;
  gatewayProvider?: string | null;
  receiptUrl?: string | null;
  // Kolom di bawah ini dikirim server sejak perbaikan checkout gabungan;
  // server lama tidak mengirimnya.
  checkoutId?: string | null;
  checkoutTotal?: number;
  checkoutInvoiceNumbers?: string[];
  isManual?: boolean;
  rejectionReason?: string | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  remainingAmount: number;
  status: string;
  dueDate: string;
  issueDate: string;
  createdAt?: string;
  items: Array<{ description: string }>;
  lastPayment?: LastPayment | null;
}

/**
 * Nominal yang ditagih gateway untuk seluruh checkout. Satu checkout bisa
 * melunasi beberapa invoice, sedangkan `amount` hanya bagian invoice ini.
 */
export function getCheckoutTotal(payment: LastPayment) {
  return payment.checkoutTotal ?? payment.amount;
}

/** Nomor tagihan yang dilunasi checkout ini. */
export function getCheckoutInvoiceNumbers(
  payment: LastPayment,
  invoiceNumber: string,
) {
  return payment.checkoutInvoiceNumbers?.length
    ? payment.checkoutInvoiceNumbers
    : [invoiceNumber];
}

/** Transfer bank manual; server lama hanya ditandai lewat `accountId`. */
export function isManualTransfer(payment: LastPayment) {
  return payment.isManual ?? Boolean(payment.accountId);
}

/** Transfer manual yang buktinya ditolak admin (gatewayStatus FAILED). */
export function isRejectedManualTransfer(payment?: LastPayment | null) {
  return payment?.gatewayStatus === "FAILED" && isManualTransfer(payment);
}

/** Tagihan terbuka yang sisanya nol: ditutup saldo kredit, menunggu diproses. */
export function isCoveredBySaldo(invoice: {
  status: string;
  remainingAmount: number;
}) {
  return (
    isOutstandingInvoiceStatus(invoice.status) && invoice.remainingAmount <= 0
  );
}

/** Metode dari daftar yang dipakai checkout ini, untuk nama dan rekeningnya. */
export function findCheckoutMethod(
  methods: PaymentMethod[],
  payment: LastPayment,
) {
  if (isManualTransfer(payment)) {
    return methods.find(
      (method) => method.id === `manual_${payment.accountId}`,
    );
  }
  // Portal menyimpan kode channel (mis. "BC") di gatewayProvider.
  return methods.find((method) => method.code === payment.gatewayProvider);
}

/**
 * Ringkasan tagihan terbuka. Termasuk PARTIAL_PAID: sisanya masih harus
 * dibayar dan ringkasan dashboard sudah menghitungnya. Tagihan yang sudah
 * ditutup saldo tidak ikut dibayar.
 */
export function summarizeInvoices(invoices: Invoice[]) {
  const outstanding = invoices.filter((inv) =>
    isOutstandingInvoiceStatus(inv.status),
  );
  const payable = outstanding.filter((inv) => !isCoveredBySaldo(inv));
  const [nextDue] = [...payable].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );
  return {
    outstanding,
    payable,
    totalPending: payable.reduce((sum, inv) => sum + inv.remainingAmount, 0),
    nextDueDate: nextDue?.dueDate ?? null,
    pendingPaymentInvoice: invoices.find(
      (inv) => inv.lastPayment?.gatewayStatus === "PENDING",
    ),
    rejectedTransfer: outstanding.find((inv) =>
      isRejectedManualTransfer(inv.lastPayment),
    )?.lastPayment,
  };
}
