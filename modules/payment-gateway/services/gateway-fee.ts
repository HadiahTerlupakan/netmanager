import { logger } from "@/lib/logger";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { PaymentGatewayManager } from "./PaymentGatewayService";

/**
 * Simpan biaya gateway untuk payment yang baru lunas, agar admin melihat
 * jumlah yang benar-benar diterima. Callback tidak membawa biaya, jadi
 * diambil dari cek status. Gagal di sini tidak mengganggu pelunasan.
 */
export async function recordGatewayFee(
  providerType: string,
  payment: { id: string; reference: string | null; tenantId: string | null },
) {
  if (!payment.reference) return;
  try {
    const status = await new PaymentGatewayManager().checkPaymentStatus(
      providerType,
      payment.reference,
      payment.tenantId ?? undefined,
    );
    if (status.fee === undefined || !Number.isFinite(status.fee)) return;
    await prismaBillingAuth.payment.update({
      where: { id: payment.id },
      data: { gatewayFee: BigInt(Math.round(status.fee)) },
    });
  } catch (error) {
    logger.warn("[Webhook] Gagal mencatat biaya gateway:", error);
  }
}
