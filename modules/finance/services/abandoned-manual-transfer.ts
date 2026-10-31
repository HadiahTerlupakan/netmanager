import {
  cancelAbandonedTransferCheckout,
  findAbandonedTransferCheckouts,
} from "../repositories/abandonedManualTransfer.repository";

/**
 * Tutup pilihan "Transfer Manual" yang belum membawa bukti untuk tagihan yang
 * tidak lagi ditagihkan (lunas, atau dibatalkan dan diganti), utuh per
 * checkout, dan kembalikan kupon yang tidak lagi dipegang payment lain.
 * Pelanggan tidak bisa lagi mengunggah bukti untuk tagihan itu, jadi payment
 * yang dibiarkan menunggu tidak punya jalan keluar. Yang sudah membawa bukti
 * tetap di antrean verifikasi admin.
 *
 * @returns jumlah payment yang ditutup
 */
export async function closeAbandonedManualTransfers(
  invoiceId: string,
): Promise<number> {
  const checkouts = await findAbandonedTransferCheckouts(invoiceId);
  if (checkouts.length === 0) return 0;

  const { releaseUnusedCheckoutCoupons } =
    await import("@/modules/payment-gateway");
  let closed = 0;
  for (const checkout of checkouts) {
    if (!(await cancelAbandonedTransferCheckout(checkout))) continue;
    closed += checkout.length;
    await releaseUnusedCheckoutCoupons(checkout);
  }
  return closed;
}
