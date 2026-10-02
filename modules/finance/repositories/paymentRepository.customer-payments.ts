import { randomUUID } from "crypto";
import {
  GatewayPaymentStatus,
  PaymentMethod,
  type Payment,
  type Prisma,
} from "@prisma/client-billing";
import { prismaBilling, prismaBillingAuth } from "@/modules/database";
import type { PaymentEntity } from "../domain/entities/PaymentEntity";

const MANUAL_PAYMENT_PREFIX = "MANUAL_";
const MANUAL_PAYMENT_VARIANTS = new Set(["MANUAL", "MOOTA_MANUAL"]);

type BillingTransactionClient = Prisma.TransactionClient;

type CustomerPaymentCouponService = {
  recordUsage(
    couponId: string,
    customerId: string,
    tx: BillingTransactionClient,
  ): Promise<unknown>;
  incrementUsage(
    couponId: string,
    tx: BillingTransactionClient,
  ): Promise<unknown>;
};

type CreateCustomerPaymentsOptions = {
  customerId: string;
  tenantId?: string | null;
  invoiceIds: string[];
  discountAmount: number;
  paymentMethod: string;
  notes?: string | null;
  couponId?: string | null;
  couponService?: CustomerPaymentCouponService;
};

/** Memetakan payment Prisma menjadi entity pembayaran domain. */
export function mapPaymentEntity(payment: Record<string, unknown>) {
  return payment as unknown as PaymentEntity;
}

/** Menyelesaikan metode pembayaran customer ke enum gateway billing. */
export function resolveCustomerPaymentMethod(paymentMethod: string) {
  if (isManualPaymentMethod(paymentMethod)) {
    return PaymentMethod.BANK_TRANSFER;
  }

  return (
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
    const discountAmounts = buildInvoiceDiscountAmounts(options);
    const payments = await createInvoicePayments(tx, options, discountAmounts);

    await applyCouponUsageIfNeeded(tx, options);
    return payments.map(mapPaymentEntity);
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

function buildInvoiceDiscountAmounts(options: CreateCustomerPaymentsOptions) {
  const invoiceCount = options.invoiceIds.length;
  const baseDiscount =
    options.discountAmount > 0
      ? Math.floor(options.discountAmount / invoiceCount)
      : 0;

  return options.invoiceIds.map((_, index) =>
    isLastInvoice(index, invoiceCount) && options.discountAmount > 0
      ? options.discountAmount - baseDiscount * (invoiceCount - 1)
      : baseDiscount,
  );
}

function isLastInvoice(index: number, total: number) {
  return index === total - 1;
}

async function createInvoicePayments(
  tx: BillingTransactionClient,
  options: CreateCustomerPaymentsOptions,
  discountAmounts: number[],
) {
  const payments = [];

  for (const [index, invoiceId] of options.invoiceIds.entries()) {
    const payment = await createInvoicePayment(tx, {
      invoiceId,
      discountAmount: discountAmounts[index],
      options,
    });

    if (payment) {
      payments.push(payment);
    }
  }

  return payments;
}

async function createInvoicePayment(
  tx: BillingTransactionClient,
  input: {
    invoiceId: string;
    discountAmount: number;
    options: CreateCustomerPaymentsOptions;
  },
) {
  const invoice = await tx.invoice.findUnique({
    where: { id: input.invoiceId },
  });
  if (!invoice) {
    return null;
  }

  return tx.payment.create({
    data: {
      id: randomUUID(),
      updatedAt: new Date(),
      amount: Number(invoice.totalAmount) - input.discountAmount,
      paymentDate: new Date(),
      paymentMethod: resolveCustomerPaymentMethod(input.options.paymentMethod),
      gatewayStatus: GatewayPaymentStatus.PENDING,
      accountId: resolveManualAccountId(input.options.paymentMethod),
      reference: `PAY-${randomUUID()}`,
      notes: input.options.notes,
      pelangganId: input.options.customerId,
      invoiceId: input.invoiceId,
      tenantId: input.options.tenantId || undefined,
    },
  });
}

async function applyCouponUsageIfNeeded(
  tx: BillingTransactionClient,
  options: CreateCustomerPaymentsOptions,
) {
  if (!options.couponId || !options.couponService) {
    return;
  }

  await options.couponService.recordUsage(
    options.couponId,
    options.customerId,
    tx,
  );
  await options.couponService.incrementUsage(options.couponId, tx);
}
