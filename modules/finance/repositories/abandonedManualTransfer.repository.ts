import type { Prisma } from "@prisma/client-billing";
import { prismaBillingAuth } from "@/lib/prisma-billing";

/** Payment transfer manual yang ditutup bersama checkout-nya. */
export type AbandonedTransferPayment = {
  id: string;
  checkoutId: string | null;
  couponUsageId: string | null;
  couponId: string | null;
  pelangganId: string;
  tenantId: string | null;
};

const ABANDONED_TRANSFER_SELECT = {
  id: true,
  checkoutId: true,
  couponUsageId: true,
  couponId: true,
  pelangganId: true,
  tenantId: true,
  receiptUrl: true,
} as const;

// Transfer manual dikenali dari rekening tujuannya, seperti di sisi checkout.
const PENDING_MANUAL_TRANSFER: Prisma.PaymentWhereInput = {
  gatewayStatus: "PENDING",
  accountId: { not: null },
};

class ProofArrivedError extends Error {}

/**
 * Checkout transfer manual yang memuat tagihan ini dan belum membawa bukti
 * sama sekali, masing-masing dengan semua payment-nya: bukti satu checkout
 * menempel di semua tagihannya, jadi checkout ditutup utuh atau tidak sama
 * sekali.
 */
export async function findAbandonedTransferCheckouts(
  invoiceId: string,
): Promise<AbandonedTransferPayment[][]> {
  const direct = await prismaBillingAuth.payment.findMany({
    where: { invoiceId, ...PENDING_MANUAL_TRANSFER, receiptUrl: null },
    select: ABANDONED_TRANSFER_SELECT,
  });
  const checkoutIds = [
    ...new Set(direct.flatMap((p) => (p.checkoutId ? [p.checkoutId] : []))),
  ];
  const grouped =
    checkoutIds.length === 0
      ? []
      : await prismaBillingAuth.payment.findMany({
          where: { checkoutId: { in: checkoutIds }, gatewayStatus: "PENDING" },
          select: ABANDONED_TRANSFER_SELECT,
        });

  const standalone = direct.filter((p) => !p.checkoutId).map((p) => [p]);
  const checkouts = checkoutIds
    .map((checkoutId) => grouped.filter((p) => p.checkoutId === checkoutId))
    .filter((group) => group.every((p) => p.receiptUrl === null));
  return [...standalone, ...checkouts].map((group) =>
    group.map(({ receiptUrl: _receiptUrl, ...payment }) => payment),
  );
}

/**
 * Tutup satu checkout bila semua payment-nya masih PENDING tanpa bukti;
 * false bila bukti baru saja diunggah (checkout-nya dibiarkan utuh).
 */
export async function cancelAbandonedTransferCheckout(
  checkout: AbandonedTransferPayment[],
): Promise<boolean> {
  const ids = checkout.map((payment) => payment.id);
  try {
    await prismaBillingAuth.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        where: { id: { in: ids }, gatewayStatus: "PENDING", receiptUrl: null },
        data: { gatewayStatus: "CANCELLED" },
      });
      if (count !== ids.length) throw new ProofArrivedError();
    });
    return true;
  } catch (error) {
    if (error instanceof ProofArrivedError) return false;
    throw error;
  }
}
