import crypto from "crypto";
import { logger } from "@/lib/logger";
import { fetchWithTimeout } from "./fetch-with-timeout";
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
  buildVirtualAccountPaymentResult,
  buildVirtualAccountStatusResult,
} from "./virtual-account-provider-helper";
import {
  buildBcaCreatePaymentBody,
  buildBcaHeaders,
  buildBcaStatusUrl,
  buildBcaWebhookPaymentResult,
  generateBcaSignature,
  getBcaAccessToken,
  normalizeBcaStatus,
  resolveBcaBaseUrl,
  verifyBcaWebhookSignature,
} from "./bca-provider-utils";

const BCA_PAYMENT_URL = "/va/payments";

export class BCAProvider implements PaymentProvider {
  name = "BCA API";
  private config?: ProviderConfig;
  private baseUrl?: string;

  /** Inisialisasi config dan base URL BCA. */
  initialize(config: ProviderConfig): void {
    this.config = config;
    this.baseUrl = resolveBcaBaseUrl(config.isProduction);
  }

  /** Membuat virtual account BCA. */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      const config = this.requireConfig();
      const accessToken = await this.getAccessToken();
      const expiryDate = this.createExpiryDate(params.expiryHours);
      const requestBody = buildBcaCreatePaymentBody(params, config, expiryDate);
      const bodyString = JSON.stringify(requestBody);
      const timestamp = new Date().toISOString();
      const signature = generateBcaSignature({
        method: "POST",
        relativeUrl: BCA_PAYMENT_URL,
        accessToken,
        body: bodyString,
        timestamp,
        apiSecret: config.apiSecret || "",
      });
      const response = await fetchWithTimeout(
        `${this.baseUrl}${BCA_PAYMENT_URL}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...buildBcaHeaders({
              accessToken,
              apiKey: config.apiKey,
              timestamp,
              signature,
              correlationId: crypto.randomUUID(),
            }),
            Origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          },
          body: bodyString,
        },
      );

      if (!response.ok) {
        const errorData = (await response.json()) as { ErrorMessage?: string };
        throw new Error(errorData.ErrorMessage || "Failed to create BCA VA");
      }

      const data = (await response.json()) as {
        TransactionID?: string;
        VirtualAccountNumber?: string;
      };

      return buildVirtualAccountPaymentResult({
        transactionId: data.TransactionID,
        fallbackTransactionId: params.orderId,
        vaNumber: data.VirtualAccountNumber,
        paymentPath: `/payment/bca/${data.VirtualAccountNumber}`,
        expiresAt: expiryDate,
      });
    } catch (error: unknown) {
      logger.error("BCA createPayment error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create payment",
      };
    }
  }

  /** Mengecek status virtual account BCA. */
  async checkStatus(orderId: string): Promise<TransactionStatus> {
    try {
      const config = this.requireConfig();
      const accessToken = await this.getAccessToken();
      const timestamp = new Date().toISOString();
      const url = buildBcaStatusUrl(config.merchantId, orderId);
      const signature = generateBcaSignature({
        method: "GET",
        relativeUrl: url,
        accessToken,
        body: "",
        timestamp,
        apiSecret: config.apiSecret || "",
      });
      const response = await fetchWithTimeout(`${this.baseUrl}${url}`, {
        method: "GET",
        headers: buildBcaHeaders({
          accessToken,
          apiKey: config.apiKey,
          timestamp,
          signature,
          correlationId: crypto.randomUUID(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to check BCA payment status");
      }

      const data = (await response.json()) as {
        TransactionStatus?: string;
        PaidStatus?: string;
        PaidDate?: string;
        TotalAmount?: { Value?: string };
        TransactionID?: string;
      };

      return buildVirtualAccountStatusResult({
        orderId,
        status: normalizeBcaStatus({
          transactionStatus: data.TransactionStatus,
          paidStatus: data.PaidStatus,
        }),
        paidAt: data.PaidDate,
        paymentMethod: "BCA Virtual Account",
        amount: data.TotalAmount?.Value,
        transactionId: data.TransactionID,
      });
    } catch (error: unknown) {
      logger.error("BCA checkStatus error:", error);
      throw error;
    }
  }

  /** Membiarkan VA BCA expired otomatis. */
  async cancelPayment(_orderId: string): Promise<void> {}

  /** Memverifikasi signature webhook BCA. */
  verifyWebhook(payload: unknown, signature?: string): boolean {
    try {
      if (!this.config || !signature || !this.isRecord(payload)) {
        return false;
      }

      return verifyBcaWebhookSignature({
        payload,
        signature,
        apiSecret: this.config.apiSecret || "",
      });
    } catch (error) {
      logger.error("BCA webhook verification error:", error);
      return false;
    }
  }

  /** Menormalkan payload webhook BCA. */
  async processWebhook(payload: unknown): Promise<WebhookResult> {
    if (!this.isRecord(payload)) {
      throw new Error("Invalid BCA webhook payload");
    }

    try {
      return buildBcaWebhookPaymentResult(payload);
    } catch (error: unknown) {
      logger.error("BCA processWebhook error:", error);
      throw error;
    }
  }

  /** Mengetes koneksi credential BCA. */
  async testConnection(): Promise<TestResult> {
    try {
      if (!this.config) {
        return { success: false, message: "Provider not initialized" };
      }

      const accessToken = await this.getAccessToken();
      if (accessToken) {
        return {
          success: true,
          message: "Connection successful - Access token obtained",
          details: {
            baseUrl: this.baseUrl,
            environment: this.config.isProduction ? "Production" : "Sandbox",
            tokenLength: accessToken.length,
          },
        };
      }

      return { success: false, message: "Gagal mendapatkan access token" };
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Koneksi gagal",
        details: {
          error: (error as { code?: string })?.code,
        },
      };
    }
  }

  /** Mengambil access token OAuth2 BCA. */
  private async getAccessToken() {
    const config = this.requireConfig();
    return getBcaAccessToken({ baseUrl: this.baseUrl || "", config });
  }

  /** Membuat expiry date virtual account. */
  private createExpiryDate(expiryHours?: number) {
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + (expiryHours || 24));
    return expiryDate;
  }

  /** Memastikan provider BCA sudah diinisialisasi. */
  private requireConfig() {
    if (!this.config || !this.baseUrl) {
      throw new Error("BCA provider not initialized");
    }

    return this.config;
  }

  /** Memastikan payload webhook berbentuk object. */
  private isRecord(payload: unknown): payload is Record<string, unknown> {
    return typeof payload === "object" && payload !== null;
  }
}
