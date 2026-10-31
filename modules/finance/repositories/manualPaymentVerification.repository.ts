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
  accountId: true,
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

/** Checkout transfer berubah di tengah verifikasi. */
class CheckoutChangedError extends Error {}

// Galat Prisma untuk deadlock atau konflik tulis (40P01/40001) dengan
// transaksi lain yang memindahkan payment checkout yang sama.
const WRITE_CONFLICT_CODE = "P2034";

/**
 * Pindahkan seluruh payment checkout dari PENDING dalam satu pernyataan, atau
 * tidak sama sekali. Pernyataannya bersyarat (masih PENDING dan belum
 * diverifikasi), jadi pembatalan pelanggan atau keputusan admin lain yang
 * lebih dulu commit membuat klaim ini gagal bersih alih-alih ditimpa; yang
 * datang sesudahnya menemukan checkout yang sudah diverifikasi. `noteFor`
 * menulis catatan per payment di transaksi yang sama.
 *
 * @returns false bila ada payment checkout yang tidak lagi menunggu.
 */
export async function claimPendingCheckout(
  payments: VerifiablePayment[],
  data: Prisma.PaymentUpdateManyMutationInput,
  noteFor?: (payment: VerifiablePayment) => string | null,
): Promise<boolean> {
  try {
    await prismaBilling.$transaction(async (tx) => {
      // updateManyAndReturn tidak disaring tenant oleh ekstensi Prisma; id
      // payment berasal dari pembacaan yang sudah tersaring tenant.
      const claimed = await tx.payment.updateManyAndReturn({
        where: {
          id: { in: payments.map((payment) => payment.id) },
          gatewayStatus: "PENDING",
          verifiedAt: null,
        },
        data,
        select: { id: true },
      });
      if (claimed.length !== payments.length) throw new CheckoutChangedError();
      if (!noteFor) return;
      for (const payment of payments) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { notes: noteFor(payment) },
        });
      }
    });
    return true;
  } catch (error) {
    if (
      error instanceof CheckoutChangedError ||
      (error as { code?: string }).code === WRITE_CONFLICT_CODE
    ) {
      return false;
    }
    throw error;
  }
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
