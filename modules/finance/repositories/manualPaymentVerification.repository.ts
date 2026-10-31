import type { Prisma } from "@prisma/client-billing";
import { prismaBilling } from "@/lib/prisma-billing";

const VERIFIABLE_PAYMENT_SELECT = {
  id: true,
  checkoutId: true,
  invoiceId: true,
  pelangganId: true,
  tenantId: true,
  amount: true,
  gatewayStatus: true,
  paymentMethod: true,
  expiresAt: true,
  transactionId: true,
  gatewayProvider: true,
  notes: true,
  couponUsageId: true,
  couponId: true,
  invoice: { select: { invoiceNumber: true, status: true } },
} satisfies Prisma.PaymentSelect;

/** Payment transfer yang diverifikasi admin, beserta tagihannya. */
export type VerifiablePayment = Prisma.PaymentGetPayload<{
  select: typeof VERIFIABLE_PAYMENT_SELECT;
}>;

/** Satu payment yang akan diverifikasi admin. */
export async function findVerifiablePayment(
  id: string,
): Promise<VerifiablePayment | null> {
  return prismaBilling.payment.findUnique({
    where: { id },
    select: VERIFIABLE_PAYMENT_SELECT,
  });
}

/**
 * Payment checkout yang masih menunggu verifikasi: satu checkout transfer
 * bisa mencakup beberapa tagihan, dan buktinya menempel di semuanya. Payment
 * lama tanpa checkoutId berdiri sendiri.
 */
export async function findPendingCheckoutPayments(payment: {
  id: string;
  checkoutId: string | null;
}): Promise<VerifiablePayment[]> {
  return prismaBilling.payment.findMany({
    where: {
      ...(payment.checkoutId
        ? { checkoutId: payment.checkoutId }
        : { id: payment.id }),
      gatewayStatus: "PENDING",
    },
    select: VERIFIABLE_PAYMENT_SELECT,
    orderBy: { id: "asc" },
  });
}

/**
 * Pindahkan payment dari PENDING dalam satu transaksi, baris demi baris
 * dengan urutan id yang tetap. Hanya id yang benar-benar dipindah transaksi
 * ini yang dikembalikan: dua admin yang menyetujui dan menolak bersamaan
 * menunggu kunci baris yang sama, dan yang kedua tidak menemukan PENDING lagi.
 */
export async function claimPendingPayments(
  payments: VerifiablePayment[],
  buildData: (
    payment: VerifiablePayment,
  ) => Prisma.PaymentUpdateManyMutationInput,
): Promise<string[]> {
  const ordered = [...payments].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  return prismaBilling.$transaction(async (tx) => {
    const claimed: string[] = [];
    for (const payment of ordered) {
      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, gatewayStatus: "PENDING" },
        data: buildData(payment),
      });
      if (count > 0) claimed.push(payment.id);
    }
    return claimed;
  });
}

/** Ke tagihan mana payment berakhir dan berapa yang dikreditkan ke saldo. */
export async function findSettledPayments(ids: string[]) {
  return prismaBilling.payment.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      invoiceId: true,
      kelebihanBayar: true,
      invoice: { select: { invoiceNumber: true, status: true } },
    },
  });
}

/** Nominal dan tagihan setiap payment dari checkout-checkout ini. */
export async function findCheckoutPaymentRows(checkoutIds: string[]) {
  if (checkoutIds.length === 0) return [];
  return prismaBilling.payment.findMany({
    where: { checkoutId: { in: checkoutIds } },
    select: {
      checkoutId: true,
      amount: true,
      invoice: { select: { invoiceNumber: true, dueDate: true } },
    },
  });
}
