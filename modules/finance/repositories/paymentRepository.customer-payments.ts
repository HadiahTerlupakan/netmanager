import { randomUUID } from "crypto";
import {
  GatewayPaymentStatus,
  PaymentMethod,
  type Payment,
  type Prisma,
} from "@prisma/client-billing";
import { prismaBilling, prismaBillingAuth } from "@/modules/database";
import { findBillingPaymentMethod } from "@/modules/payment-gateway/catalog";
import type { PaymentEntity } from "../domain/entities/PaymentEntity";

const MANUAL_PAYMENT_PREFIX = "MANUAL_";
const MANUAL_PAYMENT_VARIANTS = new Set(["MANUAL", "MOOTA_MANUAL"]);
const FAILURE_REASON_MAX_LENGTH = 500;

const MANUAL_CHECKOUT_SELECT = {
  id: true,
  checkoutId: true,
  invoiceId: true,
  pelangganId: true,
  amount: true,
  notes: true,
  receiptUrl: true,
  couponUsageId: true,
  couponId: true,
  tenantId: true,
} as const;

export type ManualCheckoutPayment = {
  id: string;
  checkoutId: string | null;
  invoiceId: string | null;
  pelangganId: string;
  amount: bigint;
  notes: string | null;
  receiptUrl: string | null;
  couponUsageId: string | null;
  couponId: string | null;
  tenantId: string | null;
};

type BillingTransactionClient = Prisma.TransactionClient;

type CreateCustomerPaymentsOptions = {
  customerId: string;
  tenantId?: string | null;
  invoiceIds: string[];
  discountAmount: number;
  paymentMethod: string;
  notes?: string | null;
  couponUsageId?: string | null;
  couponId?: string | null;
};

/** Memetakan payment Prisma menjadi entity pembayaran domain. */
export function mapPaymentEntity(payment: Record<string, unknown>) {
  return payment as unknown as PaymentEntity;
}

/**
 * Menyelesaikan metode pembayaran customer ke enum billing: transfer manual,
 * kode kanal gateway (mis. "BC" → BANK_TRANSFER), lalu nama enum langsung.
 */
export function resolveCustomerPaymentMethod(paymentMethod: string) {
  if (isManualPaymentMethod(paymentMethod)) {
    return PaymentMethod.BANK_TRANSFER;
  }

  return (
    findBillingPaymentMethod(paymentMethod) ??
    PaymentMethod[paymentMethod as keyof typeof PaymentMethod] ??
    PaymentMethod.OTHER
  );
}

/** Menyelesaikan account id manual berdasarkan metode pembayaran. */
export function resolveManualAccountId(paymentMethod: string) {
  return paymentMethod.startsWith(MANUAL_PAYMENT_PREFIX)
    ? paymentMethod.replace(MANUAL_PAYMENT_PREFIX, "")
    : null;
}

/** Membuat pembayaran customer untuk banyak invoice dalam satu transaksi. */
export async function createCustomerPaymentsForInvoices(
  options: CreateCustomerPaymentsOptions,
) {
  return prismaBilling.$transaction(async (tx: Prisma.TransactionClient) => {
    const payments = await createInvoicePayments(tx, options);
    return payments.map(mapPaymentEntity);
  });
}

/**
 * Tandai payment checkout yang gagal dibuat di gateway, beserta alasan dari
 * gateway untuk admin. Pemesanan kupon dilepas dari payment ini: kupon yang
 * dipindah dari checkout lama tetap milik checkout lama itu.
 */
export function markCustomerCheckoutFailed(
  paymentIds: string[],
  failureReason: string,
) {
  return prismaBilling.payment.updateMany({
    where: { id: { in: paymentIds } },
    data: {
      gatewayStatus: GatewayPaymentStatus.FAILED,
      failureReason: failureReason.slice(0, FAILURE_REASON_MAX_LENGTH),
      couponUsageId: null,
    },
  });
}

/**
 * Payment transfer manual yang masih menunggu (belum diverifikasi) dari
 * checkout yang memuat invoice ini, seluruh invoice-nya; kosong bila tidak
 * ada. Transfer manual dikenali dari rekening tujuannya (accountId).
 */
export async function findPendingManualCheckout(options: {
  invoiceId: string;
  pelangganId: string;
}): Promise<ManualCheckoutPayment[]> {
  const pendingManual: Prisma.PaymentWhereInput = {
    pelangganId: options.pelangganId,
    gatewayStatus: GatewayPaymentStatus.PENDING,
    accountId: { not: null },
    verifiedAt: null,
  };
  const latest = await prismaBilling.payment.findFirst({
    where: { ...pendingManual, invoiceId: options.invoiceId },
    orderBy: { paymentDate: "desc" },
    select: { id: true, checkoutId: true },
  });
  if (!latest) return [];

  return prismaBilling.payment.findMany({
    where: latest.checkoutId
      ? { ...pendingManual, checkoutId: latest.checkoutId }
      : { id: latest.id },
    select: MANUAL_CHECKOUT_SELECT,
  });
}

/**
 * Tutup payment transfer manual yang belum diverifikasi; mengembalikan
 * jumlah yang benar-benar tertutup (admin bisa menyetujuinya lebih dulu).
 */
export async function cancelPendingManualPayments(paymentIds: string[]) {
  const { count } = await prismaBilling.payment.updateMany({
    where: {
      id: { in: paymentIds },
      gatewayStatus: GatewayPaymentStatus.PENDING,
      verifiedAt: null,
    },
    data: { gatewayStatus: GatewayPaymentStatus.CANCELLED },
  });
  return count;
}

/**
 * Lampirkan bukti transfer ke setiap payment checkout yang masih menunggu
 * verifikasi; mengembalikan jumlah payment yang terlampiri.
 */
export function attachReceiptToPayments(input: {
  receiptUrl: string;
  payments: Array<{ id: string; notes: string }>;
}) {
  return prismaBilling.$transaction(async (tx: BillingTransactionClient) => {
    let attached = 0;
    for (const payment of input.payments) {
      const { count } = await tx.payment.updateMany({
        where: {
          id: payment.id,
          gatewayStatus: GatewayPaymentStatus.PENDING,
          verifiedAt: null,
        },
        data: { receiptUrl: input.receiptUrl, notes: payment.notes },
      });
      attached += count;
    }
    return attached;
  });
}

/** Payment menunggu terbaru milik pelanggan untuk invoice ini, bila ada. */
export function findLatestPendingCustomerPayment(options: {
  invoiceId: string;
  pelangganId: string;
}) {
  return prismaBilling.payment.findFirst({
    where: {
      invoiceId: options.invoiceId,
      pelangganId: options.pelangganId,
      gatewayStatus: GatewayPaymentStatus.PENDING,
    },
    orderBy: { paymentDate: "desc" },
    select: { id: true, gatewayStatus: true },
  });
}

/** Mengambil pembayaran pertama lewat auth client untuk webhook. */
export async function findFirstAuthPayment(
  where: unknown,
): Promise<Payment | null> {
  return prismaBillingAuth.payment.findFirst({ where: where as never });
}

function isManualPaymentMethod(paymentMethod: string) {
  return (
    paymentMethod.startsWith(MANUAL_PAYMENT_PREFIX) ||
    MANUAL_PAYMENT_VARIANTS.has(paymentMethod)
  );
}

async function createInvoicePayments(
  tx: BillingTransactionClient,
  options: CreateCustomerPaymentsOptions,
) {
  const payments = [];
  const checkoutId = randomUUID();
  // Diskon kupon dihitung atas total; dibagikan berurutan dan dibatasi sisa
  // tiap invoice supaya tidak ada pembayaran bernominal negatif.
  let undistributedDiscount = Math.max(options.discountAmount, 0);

  for (const invoiceId of options.invoiceIds) {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      continue;
    }

    // Gateway ditagih sebesar sisa (total − paidAmount), dan nominal struk
    // transfer manual dicocokkan ke amount ini; memakai total membuat invoice
    // PARTIAL_PAID tertagih ulang bagian yang sudah dibayar.
    const remainingAmount =
      Number(invoice.totalAmount) - Number(invoice.paidAmount);
    const discountAmount = Math.min(undistributedDiscount, remainingAmount);
    undistributedDiscount -= discountAmount;

    payments.push(
      await createInvoicePayment(tx, {
        invoiceId,
        amount: remainingAmount - discountAmount,
        discountAmount,
        checkoutId,
        options,
      }),
    );
  }

  return payments;
}

function createInvoicePayment(
  tx: BillingTransactionClient,
  input: {
    invoiceId: string;
    amount: number;
    discountAmount: number;
    checkoutId: string;
    options: CreateCustomerPaymentsOptions;
  },
) {
  return tx.payment.create({
    data: {
      id: randomUUID(),
      updatedAt: new Date(),
      amount: input.amount,
      discountAmount: input.discountAmount,
      checkoutId: input.checkoutId,
      couponUsageId: input.options.couponUsageId ?? null,
      couponId: input.options.couponUsageId ? input.options.couponId : null,
      paymentDate: new Date(),
      paymentMethod: resolveCustomerPaymentMethod(input.options.paymentMethod),
      // Tertutup penuh oleh kupon: tidak ada yang perlu ditagih atau
      // diverifikasi, jadi langsung lunas.
      gatewayStatus:
        input.amount === 0
          ? GatewayPaymentStatus.PAID
          : GatewayPaymentStatus.PENDING,
      accountId: resolveManualAccountId(input.options.paymentMethod),
      reference: `PAY-${randomUUID()}`,
      notes: input.options.notes,
      pelangganId: input.options.customerId,
      invoiceId: input.invoiceId,
      tenantId: input.options.tenantId || undefined,
    },
  });
}
