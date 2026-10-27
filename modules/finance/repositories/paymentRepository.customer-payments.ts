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
    const payments = await createInvoicePayments(tx, options);
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
