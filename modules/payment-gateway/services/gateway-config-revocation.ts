import type {
  GatewayConfigRevocation,
  IPaymentGatewayConfigRepository,
} from "../domain/ports/IPaymentGatewayConfigRepository";
import { isValidProviderType } from "../domain/value-objects/ProviderType";
import { PaymentGatewayConfigRepository } from "../repositories/PaymentGatewayConfigRepository";

/**
 * Sakelar darurat konfigurasi gateway satu tenant, mis. saat kredensialnya
 * bocor. Selama dicabut, checkout baru, callback, dan cek status untuk
 * konfigurasi itu ditolak (PaymentGatewayManager); isEnabled tidak berubah,
 * jadi memulihkan mengembalikan keadaan sebelumnya. Null bila provider tidak
 * dikenal atau tenant belum punya konfigurasinya.
 */
export async function setGatewayConfigRevoked(
  input: { provider: string; tenantId: string; isRevoked: boolean },
  repository: Pick<
    IPaymentGatewayConfigRepository,
    "setRevoked"
  > = new PaymentGatewayConfigRepository(),
): Promise<GatewayConfigRevocation | null> {
  if (!isValidProviderType(input.provider)) return null;
  return repository.setRevoked(input.provider, input.tenantId, input.isRevoked);
}
