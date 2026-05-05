import type { PaymentGatewayConfig } from "../entities/PaymentGatewayConfig";
import type { ProviderType } from "../value-objects/ProviderType";

/** Repository port for payment gateway config persistence */
export interface IPaymentGatewayConfigRepository {
  findEnabled(tenantId?: string | null): Promise<PaymentGatewayConfig[]>;
  findByProvider(
    provider: ProviderType,
    tenantId?: string | null,
  ): Promise<PaymentGatewayConfig | null>;
  save(config: PaymentGatewayConfig): Promise<void>;
  update(id: string, data: Partial<PaymentGatewayConfig>): Promise<void>;
}
