import { logger } from "@/lib/logger";
// Gateway Manager - Manages all payment providers

import { PaymentGatewayConfigRepository } from "../repositories/PaymentGatewayConfigRepository";
import { ProviderFactory } from "./provider-factory";
import type {
  PaymentProvider,
  CreatePaymentParams,
  PaymentResult,
  StatusCheckOptions,
} from "./provider-interface";
import type { PaymentGatewayConfig } from "../domain/entities/PaymentGatewayConfig";
import { decryptApiKey } from "@/lib/utils/encryption";

export class PaymentGatewayManager {
  private configRepository: PaymentGatewayConfigRepository;

  constructor(configRepository = new PaymentGatewayConfigRepository()) {
    this.configRepository = configRepository;
  }

  /**
   * Get all enabled providers, sorted by priority
   */
  async getEnabledProviders(tenantId?: string) {
    return this.configRepository.findEnabled(tenantId);
  }

  /**
   * Get best provider for payment (based on priority)
   */
  async getBestProvider(tenantId?: string) {
    const providers = await this.getEnabledProviders(tenantId);
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
   * Provider untuk checkout baru: konfigurasinya harus aktif dan tidak
   * dicabut.
   */
  async getProviderInstance(
    providerType: string,
    tenantId?: string,
  ): Promise<PaymentProvider> {
    const config = await this.findConfig(providerType, tenantId);
    if (!config.isEnabled || config.isRevoked) {
      throw new Error(`Provider ${providerType} is disabled`);
    }

    return this.initializeProvider(providerType, config);
  }

  /**
   * Provider untuk transaksi yang sudah terbit: callback, cek status, dan
   * pembatalan. `tenantId` adalah tenant pemilik payment-nya; konfigurasi
   * tenant itu dipakai walau dimatikan, karena mematikan hanya menghentikan
   * checkout baru: VA/QR yang sudah diberikan tetap bisa dibayar dan uangnya
   * harus dibukukan. Tanpa tenant hanya konfigurasi aktif yang tunggal yang
   * dipakai (findByProvider). Konfigurasi yang dicabut selalu ditolak.
   */
  async getIssuedTransactionProvider(
    providerType: string,
    tenantId?: string,
  ): Promise<PaymentProvider> {
    const config = await this.findConfig(providerType, tenantId);
    if (config.isRevoked) {
      throw new Error(`Provider ${providerType} is revoked`);
    }

    return this.initializeProvider(providerType, config);
  }

  private async findConfig(providerType: string, tenantId?: string) {
    const config = await this.configRepository.findByProvider(
      providerType as import("../domain/value-objects/ProviderType").ProviderType,
      tenantId,
    );

    if (!config) {
      throw new Error(
        `Provider ${providerType} not configured${tenantId ? " for tenant " + tenantId : ""}`,
      );
    }

    return config;
  }

  private initializeProvider(
    providerType: string,
    config: PaymentGatewayConfig,
  ): PaymentProvider {
    const provider = ProviderFactory.createProvider(providerType);

    // Decrypt API keys and initialize
    const decryptedApiKey = config.apiKey ? decryptApiKey(config.apiKey) : "";
    if (!decryptedApiKey) {
      throw new Error(
        `Provider ${providerType} has no API key configured. Please set the API key in admin settings.`,
      );
    }

    const apiSecret = config.apiSecret
      ? decryptApiKey(config.apiSecret)
      : undefined;

    provider.initialize({
      apiKey: decryptedApiKey,
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
    if (!params.amount || params.amount <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    const providers = await this.configRepository.findEnabled(params.tenantId);
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
      logger.error(
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
    if (!params.amount || params.amount <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    const provider = await this.getProviderInstance(
      providerType,
      params.tenantId,
    );
    return provider.createPayment(params);
  }

  /**
   * Cek status transaksi yang sudah terbit. `timeoutMs` membatasi waktu
   * tunggu bagi pemanggil yang sedang memegang kunci checkout.
   */
  async checkPaymentStatus(
    providerType: string,
    orderId: string,
    tenantId?: string,
    options?: StatusCheckOptions,
  ) {
    const provider = await this.getIssuedTransactionProvider(
      providerType,
      tenantId,
    );
    return provider.checkStatus(orderId, options);
  }

  /**
   * Kode kanal yang dilaporkan aktif oleh gateway untuk nominal ini; null
   * bila gateway tidak punya daftar kanal sehingga katalog statis dipakai.
   */
  async getActivePaymentMethods(
    providerType: string,
    amount: number,
    tenantId?: string,
  ): Promise<string[] | null> {
    const provider = await this.getProviderInstance(providerType, tenantId);
    return provider.getActivePaymentMethods
      ? provider.getActivePaymentMethods(amount)
      : null;
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
    const provider = await this.getIssuedTransactionProvider(
      providerType,
      tenantId,
    );

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
      merchantId?: string;
      clientKey?: string;
      isProduction: boolean;
    },
  ) {
    const provider = ProviderFactory.createProvider(providerType);

    // If temp config provided, use it (for testing before saving)
    if (tempConfig) {
      provider.initialize(tempConfig);
      return provider.testConnection();
    }

    // Otherwise use saved config
    const savedProvider = await this.getProviderInstance(providerType);
    return savedProvider.testConnection();
  }
}
