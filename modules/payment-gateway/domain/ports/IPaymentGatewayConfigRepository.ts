import type { PaymentGatewayConfig } from "../entities/PaymentGatewayConfig";
import type { ProviderType } from "../value-objects/ProviderType";

/** Status sakelar darurat satu konfigurasi gateway, tanpa kredensialnya. */
export type GatewayConfigRevocation = {
  id: string;
  provider: string;
  isRevoked: boolean;
};

/** Repository port for payment gateway config persistence */
export interface IPaymentGatewayConfigRepository {
  findEnabled(tenantId?: string | null): Promise<PaymentGatewayConfig[]>;
  findByProvider(
    provider: ProviderType,
    tenantId?: string | null,
  ): Promise<PaymentGatewayConfig | null>;
  countEnabledSandbox(
    provider: ProviderType,
    tenantId?: string | null,
  ): Promise<number>;
  setRevoked(
    provider: ProviderType,
    tenantId: string,
    isRevoked: boolean,
  ): Promise<GatewayConfigRevocation | null>;
  save(config: PaymentGatewayConfig): Promise<void>;
  update(id: string, data: Partial<PaymentGatewayConfig>): Promise<void>;
}
