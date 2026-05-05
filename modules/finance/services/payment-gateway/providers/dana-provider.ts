import { logger } from "@/lib/logger";
import type {
  CreatePaymentParams,
  PaymentProvider,
  PaymentResult,
  ProviderConfig,
  TestResult,
  TransactionStatus,
  WebhookResult,
} from "../provider-interface";
import {
  buildDanaCreatePayload,
  buildDanaFallbackTestResult,
  buildDanaPaymentResult,
  buildDanaStatusResult,
  buildDanaTestResult,
  buildDanaWebhookResult,
  createDanaHeaders,
  createDanaSignature,
  extractDanaStatusData,
  isDanaSuccessResponse,
  parseDanaCreateResponse,
  parseDanaStatusResponse,
  parseDanaTestResponse,
  resolveDanaApiError,
  resolveDanaBaseUrl,
  type DanaWebhookPayload,
} from "./dana-provider-helpers";

export class DANAProvider implements PaymentProvider {
  name = "DANA";
  private config: ProviderConfig | null = null;
  private baseUrl = "";

  /** Inisialisasi config dan base URL DANA. */
  initialize(config: ProviderConfig): void {
    this.config = config;
    this.baseUrl = resolveDanaBaseUrl(config);
  }

  /** Membuat pembayaran baru via DANA. */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const config = this.requireConfig();

    try {
      const { payload, expiryTime } = buildDanaCreatePayload(
        params,
        config.merchantId,
      );
      const body = JSON.stringify(payload);
      const response = await fetch(`${this.baseUrl}/v1/orders`, {
        method: "POST",
        headers: this.createSignedHeaders(body),
        body,
      });
      const result = parseDanaCreateResponse(await response.json());

      if (!isDanaSuccessResponse(response, result)) {
        return {
          success: false,
          error: resolveDanaApiError(result) || "Failed to create DANA payment",
        };
      }

      return buildDanaPaymentResult(result, expiryTime);
    } catch (error: unknown) {
      logger.error("DANA create payment error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create payment",
      };
    }
  }

  /** Mengecek status transaksi DANA. */
  async checkStatus(orderId: string): Promise<TransactionStatus> {
    this.requireConfig();

    try {
      const response = await fetch(`${this.baseUrl}/v1/orders/${orderId}`, {
        method: "GET",
        headers: this.createTimestampedHeaders(),
      });
      const result = parseDanaStatusResponse(await response.json());

      if (!isDanaSuccessResponse(response, result)) {
        throw new Error(
          resolveDanaApiError(result) || "Failed to check status",
        );
      }

      return buildDanaStatusResult(
        orderId,
        extractDanaStatusData(result) || {},
      );
    } catch (error: unknown) {
      logger.error("DANA check status error:", error);
      throw error;
    }
  }

  /** Membatalkan pembayaran DANA bila endpoint tersedia. */
  async cancelPayment(orderId: string): Promise<void> {
    const config = this.requireConfig();

    try {
      const payload = JSON.stringify({
        merchantOrderId: orderId,
        merchantId: config.merchantId,
      });

      await fetch(`${this.baseUrl}/v1/orders/${orderId}/cancel`, {
        method: "POST",
        headers: this.createSignedHeaders(payload),
        body: payload,
      });
    } catch (error: unknown) {
      logger.error("DANA cancel payment error:", error);
    }
  }

  /** Memverifikasi signature webhook DANA. */
  verifyWebhook(payload: unknown, signature?: string): boolean {
    if (!this.config?.apiSecret || !signature || !this.isRecord(payload)) {
      return false;
    }

    const payloadBody = JSON.stringify(payload);
    return (
      createDanaSignature(this.config.apiSecret, payloadBody) === signature
    );
  }

  /** Menormalkan payload webhook DANA. */
  async processWebhook(payload: unknown): Promise<WebhookResult> {
    return buildDanaWebhookResult((payload as DanaWebhookPayload) ?? {});
  }

  /** Mengetes koneksi credential DANA. */
  async testConnection(): Promise<TestResult> {
    const config = this.config;

    if (!config) {
      return { success: false, message: "Provider not initialized" };
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/merchant/info`, {
        method: "GET",
        headers: this.createTimestampedHeaders(),
      });
      const result = parseDanaTestResponse(await response.json());

      return buildDanaTestResult(config, response, result);
    } catch (error: unknown) {
      if (config.apiKey && config.merchantId) {
        return buildDanaFallbackTestResult(config);
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : "Koneksi gagal",
      };
    }
  }

  /** Memastikan provider sudah diinisialisasi. */
  private requireConfig() {
    if (!this.config) {
      throw new Error("Provider not initialized");
    }

    return this.config;
  }

  /** Membuat header DANA dengan timestamp baru. */
  private createTimestampedHeaders() {
    const config = this.requireConfig();
    const timestamp = Date.now().toString();
    const signature = createDanaSignature(config.apiSecret || "", timestamp);

    return createDanaHeaders({ config, timestamp, signature });
  }

  /** Membuat header DANA yang ditandatangani body request. */
  private createSignedHeaders(body: string) {
    const headers = this.createTimestampedHeaders();
    const config = this.requireConfig();

    return {
      ...headers,
      "X-DANA-SIGNATURE": createDanaSignature(config.apiSecret || "", body),
    };
  }

  /** Mengecek payload object sebelum dipakai sebagai webhook body. */
  private isRecord(payload: unknown): payload is Record<string, unknown> {
    return typeof payload === "object" && payload !== null;
  }
}
