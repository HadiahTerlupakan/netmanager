import { PaymentGatewayManager } from "@/modules/payment-gateway";
import type { TestResult } from "@/modules/payment-gateway";

export type PaymentGatewayTestConnectionParams = {
  provider: string;
  apiKey?: string | null;
  apiSecret?: string | null;
  merchantId?: string | null;
  clientKey?: string | null;
  isProduction?: boolean;
};

export class PaymentGatewayTestService {
  constructor(private readonly manager = new PaymentGatewayManager()) {}

  async testConnection(
    params: PaymentGatewayTestConnectionParams,
  ): Promise<TestResult> {
    const apiSecret = params.apiSecret?.trim();
    const merchantId = params.merchantId?.trim();
    const tempConfig = {
      apiKey: (params.apiKey ?? "").trim(),
      ...(apiSecret ? { apiSecret } : {}),
      ...(merchantId ? { merchantId } : {}),
      clientKey: (params.clientKey ?? "").trim(),
      isProduction: Boolean(params.isProduction),
    };

    return this.manager.testProviderConnection(params.provider, tempConfig);
  }
}

let paymentGatewayTestService: PaymentGatewayTestService | null = null;

export function getPaymentGatewayTestService(): PaymentGatewayTestService {
  if (!paymentGatewayTestService) {
    paymentGatewayTestService = new PaymentGatewayTestService();
  }

  return paymentGatewayTestService;
}
