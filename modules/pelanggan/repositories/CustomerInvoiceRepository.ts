import { Prisma as PrismaBilling, InvoiceStatus } from "@prisma/client-billing";
import { prisma } from "@/lib/prisma";
import { prismaBilling } from "@/lib/prisma-billing";
import { OUTSTANDING_INVOICE_STATUSES } from "@/lib/constants/invoice-status";
import { parseInvoiceStatuses } from "./pelanggan-repository-billing.helpers";

/**
 * Type for invoice with its relations used in this repository
 */
type InvoiceWithRelations = PrismaBilling.InvoiceGetPayload<{
  include: {
    invoiceItem: true;
    payment: true;
  };
}>;

/** Checkout tempat pembayaran terakhir sebuah invoice berada. */
type CheckoutSummary = { total: number; invoiceNumbers: string[] };

/** Rekening tujuan transfer manual. */
type BankAccountSummary = {
  bankName: string;
  accountName: string;
  accountNumber: string;
};

/** Invoice pelanggan beserta konteks pembayaran terakhirnya. */
export type CustomerInvoiceRow = InvoiceWithRelations & {
  lastCheckout: CheckoutSummary | null;
  lastBankAccount: BankAccountSummary | null;
};

const UNPAID_INVOICE_STATUSES = [
  ...OUTSTANDING_INVOICE_STATUSES,
] as InvoiceStatus[];

export type CustomerDashboardBillingSummary = {
  outstandingCount: number;
  outstandingAmount: number;
  nearestDueDate: string | null;
  hasOverdue: boolean;
  saldoKredit: number;
};

/**
 * Repository for customer invoice operations
 * Handles invoice queries with items, payment history, and dashboard summaries
 */
function formatInvoiceResponse(invoice: CustomerInvoiceRow) {
  return {
    ...formatInvoiceIdentity(invoice),
    ...formatInvoiceAmounts(invoice),
    items: invoice.invoiceItem.map(formatInvoiceItem),
    lastPayment: formatLastPayment(invoice),
  };
}

function formatInvoiceIdentity(invoice: InvoiceWithRelations) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
  };
}

function formatInvoiceAmounts(invoice: InvoiceWithRelations) {
  const totalAmount = Number(invoice.totalAmount);
  const paidAmount = Number(invoice.paidAmount);
  return {
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    discountAmount: Number(invoice.discountAmount),
    totalAmount,
    paidAmount,
    remainingAmount: totalAmount - paidAmount,
  };
}

function formatInvoiceItem(item: InvoiceWithRelations["invoiceItem"][number]) {
  return {
    description: item.description,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    totalPrice: Number(item.totalPrice),
  };
}

/**
 * Pembayaran terakhir invoice. Checkout beberapa invoice membuat satu payment
 * per invoice, tetapi pelanggan membayar totalnya sekali (satu VA/QR, satu
 * transfer): `amount` hanya bagian invoice ini, `checkoutTotal` yang harus
 * dibayar.
 */
function formatLastPayment(invoice: CustomerInvoiceRow) {
  const payment = invoice.payment[0];
  if (!payment) return null;
  const amount = Number(payment.amount);
  return {
    id: payment.id,
    amount,
    date: payment.paymentDate,
    method: payment.paymentMethod,
    accountId: payment.accountId,
    gatewayStatus: payment.gatewayStatus,
    expiresAt: payment.expiresAt,
    paymentUrl: payment.paymentUrl,
    vaNumber: payment.vaNumber,
    qrString: payment.qrString,
    gatewayProvider: payment.gatewayProvider,
    receiptUrl: payment.receiptUrl,
    checkoutId: payment.checkoutId,
    checkoutTotal: invoice.lastCheckout?.total ?? amount,
    checkoutInvoiceNumbers: invoice.lastCheckout?.invoiceNumbers ?? [
      invoice.invoiceNumber,
    ],
    isManual: payment.accountId !== null,
    rejectionReason: payment.rejectionReason,
    bankAccount: invoice.lastBankAccount,
  };
}

function compareByDueDate(
  a: { dueDate: Date; invoiceNumber: string },
  b: { dueDate: Date; invoiceNumber: string },
) {
  return (
    a.dueDate.getTime() - b.dueDate.getTime() ||
    a.invoiceNumber.localeCompare(b.invoiceNumber)
  );
}

/** Total dan nomor invoice (urut jatuh tempo) per checkout. */
async function findCheckoutSummaries(
  checkoutIds: string[],
): Promise<Map<string, CheckoutSummary>> {
  if (checkoutIds.length === 0) return new Map();

  const payments = await prismaBilling.payment.findMany({
    where: { checkoutId: { in: checkoutIds } },
    select: {
      checkoutId: true,
      amount: true,
      invoice: { select: { invoiceNumber: true, dueDate: true } },
    },
  });
  const grouped = new Map<string, typeof payments>();
  for (const payment of payments) {
    if (!payment.checkoutId) continue;
    grouped.set(payment.checkoutId, [
      ...(grouped.get(payment.checkoutId) ?? []),
      payment,
    ]);
  }

  return new Map(
    [...grouped].map(([checkoutId, checkout]) => [
      checkoutId,
      {
        total: checkout.reduce((sum, p) => sum + Number(p.amount), 0),
        invoiceNumbers: checkout
          .flatMap((p) => (p.invoice ? [p.invoice] : []))
          .sort(compareByDueDate)
          .map((invoice) => invoice.invoiceNumber),
      },
    ]),
  );
}

/**
 * Rekening tujuan transfer manual menurut accountId, termasuk rekening yang
 * sudah dinonaktifkan: pelanggan yang sudah mentransfer tetap perlu melihat
 * ke rekening mana ia membayar.
 */
async function findBankAccounts(
  accountIds: string[],
): Promise<Map<string, BankAccountSummary>> {
  if (accountIds.length === 0) return new Map();

  const accounts = await prisma.companyBankAccount.findMany({
    where: { id: { in: accountIds } },
    select: {
      id: true,
      bankName: true,
      accountName: true,
      accountNumber: true,
    },
  });
  return new Map(accounts.map(({ id, ...account }) => [id, account]));
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => !!value))];
}

/**
 * Percobaan checkout yang ditolak gateway (FAILED) tidak boleh menutupi
 * checkout yang masih menunggu: VA/QR lamanya tetap bisa dibayar dan harus
 * tetap tampil. Aturan yang sama dipakai aliran SSE
 * (getCustomerInvoicePaymentSnapshot).
 */
async function preferOpenCheckouts(
  invoices: InvoiceWithRelations[],
): Promise<InvoiceWithRelations[]> {
  const failedInvoiceIds = invoices
    .filter((invoice) => invoice.payment[0]?.gatewayStatus === "FAILED")
    .map((invoice) => invoice.id);
  if (failedInvoiceIds.length === 0) return invoices;

  const pending = await prismaBilling.payment.findMany({
    where: { invoiceId: { in: failedInvoiceIds }, gatewayStatus: "PENDING" },
    orderBy: { paymentDate: "desc" },
  });
  const latestPending = new Map<string, (typeof pending)[number]>();
  for (const payment of pending) {
    if (payment.invoiceId && !latestPending.has(payment.invoiceId)) {
      latestPending.set(payment.invoiceId, payment);
    }
  }

  return invoices.map((invoice) => {
    const open = latestPending.get(invoice.id);
    return open ? { ...invoice, payment: [open] } : invoice;
  });
}

async function attachPaymentDetails(
  invoices: InvoiceWithRelations[],
): Promise<CustomerInvoiceRow[]> {
  const lastPayments = invoices.map((invoice) => invoice.payment[0]);
  const [checkouts, bankAccounts] = await Promise.all([
    findCheckoutSummaries(uniqueValues(lastPayments.map((p) => p?.checkoutId))),
    findBankAccounts(uniqueValues(lastPayments.map((p) => p?.accountId))),
  ]);

  return invoices.map((invoice, index) => {
    const payment = lastPayments[index];
    return {
      ...invoice,
      lastCheckout: checkouts.get(payment?.checkoutId ?? "") ?? null,
      lastBankAccount: bankAccounts.get(payment?.accountId ?? "") ?? null,
    };
  });
}

export class CustomerInvoiceRepository {
  /** Get invoice records for legacy customer billing response. */
  async findLegacyTagihanByPelanggan(input: {
    pelangganId: string;
    tenantId?: string | null;
  }) {
    return prismaBilling.invoice.findMany({
      where: {
        pelangganId: input.pelangganId,
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        subtotal: true,
        discountAmount: true,
        taxAmount: true,
        totalAmount: true,
        status: true,
        dueDate: true,
        paidAt: true,
        createdAt: true,
        payment: {
          select: { paymentMethod: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get invoices with pagination and optional status filter
   * Includes invoice items and last payment
   */
  async findAllForCustomer(
    pelangganId: string,
    options: {
      page: number;
      limit: number;
      status?: string[];
    },
  ) {
    const { page, limit, status } = options;
    const skip = (page - 1) * limit;

    const where: PrismaBilling.InvoiceWhereInput = { pelangganId };
    if (status && status.length > 0) {
      where.status = { in: parseInvoiceStatuses(status) };
    }

    const [invoices, total] = await Promise.all([
      prismaBilling.invoice.findMany({
        where,
        orderBy: { issueDate: "desc" },
        skip,
        take: limit,
        include: {
          invoiceItem: true,
          payment: {
            orderBy: { paymentDate: "desc" },
            take: 1,
          },
        },
      }),
      prismaBilling.invoice.count({ where }),
    ]);

    return {
      invoices: await attachPaymentDetails(await preferOpenCheckouts(invoices)),
      total,
    };
  }

  /**
   * Get billing summary data for the customer dashboard
   */
  async getDashboardBillingSummary(
    pelangganId: string,
  ): Promise<CustomerDashboardBillingSummary> {
    const [invoices, saldoKredit] = await Promise.all([
      prismaBilling.invoice.findMany({
        where: {
          pelangganId,
          status: { in: UNPAID_INVOICE_STATUSES },
        },
        orderBy: { dueDate: "asc" },
        select: {
          status: true,
          dueDate: true,
          totalAmount: true,
          paidAmount: true,
        },
      }),
      this.getSaldoKredit(pelangganId),
    ]);

    const outstandingAmount = invoices.reduce((total, invoice) => {
      return total + (Number(invoice.totalAmount) - Number(invoice.paidAmount));
    }, 0);

    return {
      outstandingCount: invoices.length,
      outstandingAmount,
      nearestDueDate: invoices[0]?.dueDate.toISOString() ?? null,
      hasOverdue: invoices.some(
        (invoice) => invoice.status === InvoiceStatus.OVERDUE,
      ),
      saldoKredit,
    };
  }

  /**
   * Saldo kredit pelanggan (rupiah): kelebihan bayar yang memotong tagihan
   * berikutnya. Disimpan di database utama, bukan billing.
   */
  async getSaldoKredit(pelangganId: string): Promise<number> {
    const customer = await prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: { saldoKreditRupiah: true },
    });
    return Number(customer?.saldoKreditRupiah ?? 0n);
  }

  /**
   * Format invoices for API response
   */
  formatInvoicesForResponse(invoices: CustomerInvoiceRow[]) {
    return invoices.map(formatInvoiceResponse);
  }
}
