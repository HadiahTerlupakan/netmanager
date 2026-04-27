// Gateway Manager - Manages all payment providers

import { PaymentGatewayConfigRepository } from "../../repositories/PaymentGatewayConfigRepository";
import { ProviderFactory } from "./provider-factory";
import type {
  PaymentProvider,
  CreatePaymentParams,
  PaymentResult,
} from "./provider-interface";
import { decryptApiKey } from "@/lib/utils/encryption";

export class PaymentGatewayManager {
  private configRepository: PaymentGatewayConfigRepository;

  constructor(configRepository = new PaymentGatewayConfigRepository()) {
    this.configRepository = configRepository;
  }

  /**
   * Get all enabled providers, sorted by priority
   */
  async getEnabledProviders() {
    return this.configRepository.findEnabled();
  }

  /**
   * Get best provider for payment (based on priority)
   */
  async getBestProvider() {
    const providers = await this.getEnabledProviders();
    const firstProvider = providers[0];

    if (!firstProvider) {
      throw new Error(
        "No payment gateway enabled. Please configure at least one payment provider in admin settings.",
      );
    }

    // Return highest priority enabled provider
    return firstProvider;
  }

  /**
   * Get provider instance with decrypted config
   */
  async getProviderInstance(
    providerType: string,
    tenantId?: string,
  ): Promise<PaymentProvider> {
    const config = await this.configRepository.findByProvider(
      providerType,
      tenantId,
    );

    if (!config) {
      throw new Error(
        `Provider ${providerType} not configured${tenantId ? " for tenant " + tenantId : ""}`,
      );
    }

    if (!config.isEnabled) {
      throw new Error(`Provider ${providerType} is disabled`);
    }

    // Create provider instance
    const provider = ProviderFactory.createProvider(providerType);

    // Decrypt API keys and initialize
    const apiSecret = config.apiSecret
      ? decryptApiKey(config.apiSecret)
      : undefined;

    await provider.initialize({
      apiKey: config.apiKey ? decryptApiKey(config.apiKey) : "",
      ...(apiSecret ? { apiSecret } : {}),
      ...(config.clientKey ? { clientKey: config.clientKey } : {}),
      ...(config.merchantId ? { merchantId: config.merchantId } : {}),
      isProduction: config.isProduction,
      settings: (config.settings as Record<string, unknown>) || {},
    });

    return provider;
  }

  /**
   * Create payment with automatic provider selection
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const providers = await this.configRepository.findEnabled();
    const providerConfig = providers[0];

    if (!providerConfig) {
      throw new Error("No payment gateway enabled.");
    }

    try {
      // Get provider instance (passing tenantId if available from params)
      const provider = await this.getProviderInstance(
        providerConfig.provider,
        params.tenantId,
      );

      // Create payment
      const result = await provider.createPayment(params);

      return result;
    } catch (error: unknown) {
      console.error(
        `Payment creation failed with ${providerConfig.provider}:`,
        error,
      );

      // Try fallback
      const fallbackProviders = providers.filter(
        (p) => p.provider !== providerConfig.provider,
      );

      for (const fallback of fallbackProviders) {
        try {
          const provider = await this.getProviderInstance(
            fallback.provider,
            params.tenantId,
          );
          return await provider.createPayment(params);
        } catch (_fallbackError: unknown) {
          continue;
        }
      }

      throw new Error(
        `All payment providers failed. Primary: ${providerConfig.provider}`,
      );
    }
  }

  /**
   * Create payment with specific provider
   */
  async createPaymentWithProvider(
    providerType: string,
    params: CreatePaymentParams,
  ): Promise<PaymentResult> {
    const provider = await this.getProviderInstance(
      providerType,
      params.tenantId,
    );
    return provider.createPayment(params);
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(
    providerType: string,
    orderId: string,
    tenantId?: string,
  ) {
    const provider = await this.getProviderInstance(providerType, tenantId);
    return provider.checkStatus(orderId);
  }

  /**
   * Process webhook from any provider
   */
  async processWebhook(
    providerType: string,
    payload: Record<string, unknown>,
    signature?: string,
    rawBody?: string,
    tenantId?: string,
  ) {
    const provider = await this.getProviderInstance(providerType, tenantId);

    // Verify webhook signature
    const isValid = provider.verifyWebhook(payload, signature, rawBody);
    if (!isValid) {
      throw new Error("Invalid webhook signature");
    }

    // Process webhook
    return provider.processWebhook(payload);
  }

  /**
   * Test provider connection
   */
  async testProviderConnection(
    providerType: string,
    tempConfig?: {
      apiKey: string;
      apiSecret?: string;
      clientKey?: string;
      isProduction: boolean;
    },
  ) {
    const provider = ProviderFactory.createProvider(providerType);

    // If temp config provided, use it (for testing before saving)
    if (tempConfig) {
      await provider.initialize(tempConfig);
      return provider.testConnection();
    }

    // Otherwise use saved config
    const savedProvider = await this.getProviderInstance(providerType);
    return savedProvider.testConnection();
  }
}
