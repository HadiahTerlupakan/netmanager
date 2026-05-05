import type { ProviderType } from "../value-objects/ProviderType";

/** Pure domain entity for payment gateway configuration */
export interface PaymentGatewayConfig {
  id: string;
  provider: ProviderType;
  apiKey: string;
  apiSecret?: string | null;
  clientKey?: string | null;
  merchantId?: string | null;
  isProduction: boolean;
  isEnabled: boolean;
  priority: number;
  settings?: Record<string, unknown> | null;
  tenantId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
