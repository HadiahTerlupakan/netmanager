import { logger } from "@/lib/logger";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { PaymentGatewayManager } from "./PaymentGatewayService";

/**
 * Simpan biaya gateway untuk payment yang baru lunas, agar admin melihat
 * jumlah yang benar-benar diterima. Cek status membawa biayanya; callback
 * tidak, jadi untuk callback biayanya ditanyakan lewat cek status. Gagal di
 * sini tidak mengganggu pelunasan.
 */
export async function recordGatewayFee(
  providerType: string,
  payment: { id: string; reference: string | null; tenantId: string | null },
  reportedFee?: number,
) {
  try {
    const fee = reportedFee ?? (await queryGatewayFee(providerType, payment));
    if (fee === undefined || !Number.isFinite(fee)) return;
    await prismaBillingAuth.payment.update({
      where: { id: payment.id },
      data: { gatewayFee: BigInt(Math.round(fee)) },
    });
  } catch (error) {
    logger.warn("[Pembayaran] Gagal mencatat biaya gateway:", error);
  }
}

async function queryGatewayFee(
  providerType: string,
  payment: { reference: string | null; tenantId: string | null },
): Promise<number | undefined> {
  if (!payment.reference) return undefined;
  const status = await new PaymentGatewayManager().checkPaymentStatus(
    providerType,
    payment.reference,
    payment.tenantId ?? undefined,
  );
  return status.fee;
}
