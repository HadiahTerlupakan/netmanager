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
  buildVirtualAccountPaymentResult,
  buildVirtualAccountStatusResult,
  buildVirtualAccountWebhookResult,
  createVirtualAccountExpiryDate,
} from "./virtual-account-provider-helper";
import {
  buildBriWebhookResult,
  createBriBasicAuthorization,
  generateBriSignature,
  normalizeBriStatus,
  resolveBriBaseUrl,
  verifyBriWebhookSignature,
} from "./bri-provider-utils";

export class BRIProvider implements PaymentProvider {
  name = "BRI API";
  private config?: ProviderConfig;
  private baseUrl?: string;

  /** Inisialisasi config dan base URL BRI. */
  initialize(config: ProviderConfig): void {
    this.config = config;
    this.baseUrl = resolveBriBaseUrl(config.isProduction);
  }

  /** Membuat pembayaran virtual account BRI. */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      const config = this.requireConfig();
      const accessToken = await this.getAccessToken();
      const expiryDate = createVirtualAccountExpiryDate(params.expiryHours);
      const requestBody = this.buildCreatePaymentBody(
        params,
        config,
        expiryDate,
      );
      const bodyString = JSON.stringify(requestBody);
      const timestamp = new Date().toISOString();
      const url = "/v1/briva";
      const signature = this.createRequestSignature({
        method: "POST",
        url,
        accessToken,
        body: bodyString,
        timestamp,
      });

      const response = await fetch(`${this.baseUrl}${url}`, {
        method: "POST",
        headers: this.createApiHeaders(accessToken, timestamp, signature),
        body: bodyString,
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message || "Failed to create payment");
      }

      const data = (await response.json()) as {
        trxId?: string;
        vaNumber?: string;
        brivaNo?: string;
      };

      return buildVirtualAccountPaymentResult({
        transactionId: data.trxId,
        fallbackTransactionId: params.orderId,
        vaNumber: data.vaNumber || data.brivaNo,
        paymentPath: `/payment/bri/${data.brivaNo}`,
        expiresAt: expiryDate,
      });
    } catch (error: unknown) {
      logger.error("BRI createPayment error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create payment",
      };
    }
  }

  /** Mengecek status pembayaran virtual account BRI. */
  async checkStatus(orderId: string): Promise<TransactionStatus> {
    try {
      const config = this.requireConfig();
      const accessToken = await this.getAccessToken();
      const timestamp = new Date().toISOString();
      const url = `/v1/briva/${config.merchantId}/${orderId}`;
      const signature = this.createRequestSignature({
        method: "GET",
        url,
        accessToken,
        body: "",
        timestamp,
      });
      const response = await fetch(`${this.baseUrl}${url}`, {
        method: "GET",
        headers: this.createApiHeaders(accessToken, timestamp, signature),
      });

      if (!response.ok) {
        throw new Error("Failed to check payment status");
      }

      const data = (await response.json()) as {
        statusBayar?: string;
        status?: string;
        paymentDate?: string;
        amount?: string;
        trxId?: string;
      };

      return buildVirtualAccountStatusResult({
        orderId,
        status: normalizeBriStatus({
          statusBayar: data.statusBayar,
          status: data.status,
        }),
        paidAt: data.paymentDate,
        paymentMethod: "BRI Virtual Account",
        amount: data.amount,
        transactionId: data.trxId,
      });
    } catch (error: unknown) {
      logger.error("BRI checkStatus error:", error);
      throw error;
    }
  }

  /** Membiarkan VA BRI expired otomatis. */
  async cancelPayment(_orderId: string): Promise<void> {}

  /** Memverifikasi signature webhook BRI. */
  verifyWebhook(payload: unknown, signature?: string): boolean {
    try {
      const config = this.config;
      if (!config?.apiSecret || !signature || !this.isRecord(payload)) {
        return false;
      }

      return verifyBriWebhookSignature({
        payload,
        signature,
        timestamp: (payload.timestamp as string) || "",
        apiSecret: config.apiSecret,
      });
    } catch (error) {
      logger.error("BRI webhook verification error:", error);
      return false;
    }
  }

  /** Menormalkan payload webhook BRI. */
  async processWebhook(payload: unknown): Promise<WebhookResult> {
    if (!this.isRecord(payload)) {
      throw new Error("Invalid BRI webhook payload");
    }

    return buildVirtualAccountWebhookResult(buildBriWebhookResult(payload));
  }

  /** Mengetes koneksi credential BRI. */
  async testConnection(): Promise<TestResult> {
    try {
      if (!this.config) {
        return {
          success: false,
          message: "Provider not initialized",
        };
      }

      const accessToken = await this.getAccessToken();
      if (accessToken) {
        return {
          success: true,
          message: "Connection successful - Access token obtained",
          details: {
            baseUrl: this.baseUrl,
            environment: this.config.isProduction ? "Production" : "Sandbox",
          },
        };
      }

      return {
        success: false,
        message: "Gagal mendapatkan access token",
      };
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

  /** Mengambil access token OAuth2 BRI. */
  private async getAccessToken(): Promise<string> {
    const config = this.requireConfig();

    try {
      const response = await fetch(
        `${this.baseUrl}/oauth/client_credential/accesstoken?grant_type=client_credentials`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: createBriBasicAuthorization(config),
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to get access token");
      }

      const data = (await response.json()) as { access_token: string };
      return data.access_token;
    } catch (error: unknown) {
      logger.error("BRI getAccessToken error:", error);
      throw error;
    }
  }

  /** Membuat signature request API BRI. */
  private createRequestSignature(input: {
    method: string;
    url: string;
    accessToken: string;
    body: string;
    timestamp: string;
  }) {
    const config = this.requireConfig();
    return generateBriSignature({
      ...input,
      apiSecret: config.apiSecret || "",
    });
  }

  /** Membuat headers standar request BRI. */
  private createApiHeaders(
    accessToken: string,
    timestamp: string,
    signature: string,
  ) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "BRI-Timestamp": timestamp,
      "BRI-Signature": signature,
    };
  }

  /** Menyusun body create payment BRI. */
  private buildCreatePaymentBody(
    params: CreatePaymentParams,
    config: ProviderConfig,
    expiryDate: Date,
  ) {
    return {
      institutionCode: config.merchantId,
      brivaNo: params.orderId,
      custCode: params.orderId.substring(0, 16),
      nama: params.customerName,
      amount: params.amount.toString(),
      keterangan: params.description,
      expiredDate: expiryDate.toISOString().split("T")[0],
    };
  }

  /** Memastikan provider BRI sudah diinisialisasi. */
  private requireConfig() {
    if (!this.config || !this.baseUrl) {
      throw new Error("BRI provider not initialized");
    }

    return this.config;
  }

  /** Memastikan payload webhook berbentuk object. */
  private isRecord(payload: unknown): payload is Record<string, unknown> {
    return typeof payload === "object" && payload !== null;
  }
}
