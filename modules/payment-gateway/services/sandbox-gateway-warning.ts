import { PaymentGatewayConfigRepository } from "../repositories/PaymentGatewayConfigRepository";

/** Teks peringatan untuk admin selama gateway produksi memakai sandbox. */
export const SANDBOX_GATEWAY_WARNING =
  "Gateway pembayaran memakai SANDBOX — pembayaran pelanggan tidak menerima uang sungguhan";

/**
 * Duitku aktif yang masih memakai kredensial SANDBOX di server produksi.
 * Untuk sementara disengaja, tetapi halaman demo sandbox Duitku bisa
 * "membayar" VA mana pun: tagihan lunas tanpa uang yang masuk. Tanpa tenant
 * (super admin, health check) seluruh tenant diperiksa.
 */
export async function isSandboxGatewayLive(
  tenantId?: string | null,
  repository = new PaymentGatewayConfigRepository(),
): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return false;
  return (await repository.countEnabledSandbox("DUITKU", tenantId)) > 0;
}
