import { logger } from "@/lib/logger";
import { getAppUrl } from "@/lib/utils/env";
import { getCustomerPortalBillingUrl } from "@/lib/utils/portal-url";
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
  buildDuitkuTestResult,
  buildDuitkuWebhookResult,
  createDuitkuInvoiceSignature,
  createDuitkuStatusSignature,
  createDuitkuWebhookSignatures,
  mapDuitkuStatus,
} from "./duitku-provider-helpers";
import { timingSafeCompare } from "./signature-compare.helpers";

// Batas panjang customerVaName di API Duitku.
const VA_NAME_MAX_LENGTH = 20;

type DuitkuInquiryResponse = {
  statusCode?: string;
  statusMessage?: string;
  Message?: string;
  paymentUrl?: string;
  vaNumber?: string;
  reference?: string;
  raw?: string;
};

// Error Duitku tidak selalu JSON berisi statusMessage: penolakan (misalnya
// nominal di bawah minimum, merchant tidak dikenal) datang sebagai HTTP 4xx
// dengan `Message` atau teks biasa.
async function readDuitkuResponse(response: {
  text: () => Promise<string>;
}): Promise<DuitkuInquiryResponse> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as DuitkuInquiryResponse;
  } catch {
    return { raw };
  }
}

function describeDuitkuError(status: number, result: DuitkuInquiryResponse) {
  const message =
    result.statusMessage || result.Message || result.raw?.slice(0, 200);
  return `Duitku HTTP ${status}: ${message || "tanpa pesan"}`;
}

export class DuitkuProvider implements PaymentProvider {
  name = "Duitku";
  private config?: ProviderConfig;
  private baseUrl = "";

  /** Inisialisasi config dan base URL Duitku. */
  initialize(config: ProviderConfig): void {
    this.config = config;
    this.baseUrl = config.isProduction
      ? "https://passport.duitku.com/webapi/api"
      : "https://sandbox.duitku.com/webapi/api";
  }

  /** Membuat invoice pembayaran Duitku. */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      const config = this.requireConfig();
      const merchantCode = config.merchantId || "";
      const merchantOrderId = params.orderId;
      const paymentAmount = params.amount;
      const expiryHours = params.expiryHours || 24;
      const requestBody = {
        merchantCode,
        paymentAmount,
        paymentMethod: params.paymentMethods?.[0] || "VC",
        merchantOrderId,
        productDetails: params.description,
        merchantUserInfo: params.customerName,
        customerVaName: params.customerName.slice(0, VA_NAME_MAX_LENGTH),
        email: params.customerEmail,
        phoneNumber: params.customerPhone,
        callbackUrl: `${getAppUrl()}/api/webhooks/duitku`,
        returnUrl: getCustomerPortalBillingUrl(),
        signature: createDuitkuInvoiceSignature({
          merchantCode,
          merchantOrderId,
          paymentAmount,
          apiKey: config.apiKey,
        }),
        expiryPeriod: expiryHours * 60,
      };
      const response = await fetchWithTimeout(
        // createinvoice adalah endpoint API POP di host lain (dengan header
        // tanda tangan sendiri); di webapi pembuatan transaksi lewat v2/inquiry.
        `${this.baseUrl}/merchant/v2/inquiry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
      );
      const result = await readDuitkuResponse(response);

      if (result.statusCode !== "00") {
        return {
          success: false,
          error: describeDuitkuError(response.status, result),
        };
      }

      return {
        success: true,
        paymentUrl: result.paymentUrl,
        vaNumber: result.vaNumber,
        transactionId: result.reference,
        expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
      };
    } catch (error: unknown) {
      logger.error("Duitku createPayment error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create payment",
      };
    }
  }

  /** Mengecek status transaksi Duitku. */
  async checkStatus(orderId: string): Promise<TransactionStatus> {
    try {
      const config = this.requireConfig();
      const merchantCode = config.merchantId || "";
      const response = await fetchWithTimeout(
        `${this.baseUrl}/merchant/transactionStatus`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchantCode,
            merchantOrderId: orderId,
            signature: createDuitkuStatusSignature({
              merchantCode,
              merchantOrderId: orderId,
              apiKey: config.apiKey,
            }),
          }),
        },
      );
      const result = (await response.json()) as {
        statusCode?: string;
        settlementDate?: string;
        paymentCode?: string;
        paymentMethod?: string;
        amount?: number;
        reference?: string;
      };
      const status = mapDuitkuStatus(result.statusCode);

      return {
        orderId,
        status,
        ...(status === "PAID"
          ? {
              paidAt: result.settlementDate
                ? new Date(result.settlementDate)
                : new Date(),
            }
          : {}),
        paymentMethod: result.paymentCode || result.paymentMethod,
        amount: result.amount,
        transactionId: result.reference,
      };
    } catch (error: unknown) {
      logger.error("Duitku checkStatus error:", error);
      throw error;
    }
  }

  /** Membiarkan transaksi Duitku expired otomatis. */
  async cancelPayment(_orderId: string): Promise<void> {}

  /** Memverifikasi signature webhook Duitku. */
  verifyWebhook(payload: unknown, _signature?: string): boolean {
    try {
      const config = this.config;
      if (!config || !this.isRecord(payload)) {
        return false;
      }

      return this.verifyDuitkuSignature(payload, config);
    } catch (error) {
      logger.error("Duitku webhook verification error:", error);
      return false;
    }
  }

  private verifyDuitkuSignature(
    payload: Record<string, unknown>,
    config: { merchantId?: string; apiKey: string },
  ) {
    const merchantCode = config.merchantId || "";
    const signature = payload.signature as string;
    return createDuitkuWebhookSignatures({
      merchantCode,
      merchantOrderId: payload.merchantOrderId as string,
      amount: payload.amount as string,
      apiKey: config.apiKey,
    }).some((expected) => timingSafeCompare(signature, expected));
  }

  /** Menormalkan payload webhook Duitku. */
  async processWebhook(payload: unknown): Promise<WebhookResult> {
    if (!this.isRecord(payload)) {
      throw new Error("Invalid Duitku webhook payload");
    }

    try {
      return buildDuitkuWebhookResult(payload);
    } catch (error: unknown) {
      logger.error("Duitku processWebhook error:", error);
      throw error;
    }
  }

  /** Mengetes koneksi credential Duitku. */
  async testConnection(): Promise<TestResult> {
    try {
      const config = this.requireConfig();
      const merchantCode = config.merchantId || "";
      const testOrderId = `TEST-${Date.now()}`;
      const response = await fetchWithTimeout(
        `${this.baseUrl}/merchant/transactionStatus`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchantCode,
            merchantOrderId: testOrderId,
            signature: createDuitkuStatusSignature({
              merchantCode,
              merchantOrderId: testOrderId,
              apiKey: config.apiKey,
            }),
          }),
        },
      );
      const result = (await response.json()) as {
        statusCode?: string;
        statusMessage?: string;
      };

      if (!result.statusCode && !result.statusMessage) {
        return {
          success: false,
          message: "Respon tidak valid dari Duitku API",
        };
      }

      return buildDuitkuTestResult(config);
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Koneksi gagal",
        details: {
          error: (error as Record<string, unknown>)?.code,
        },
      };
    }
  }

  /** Memastikan provider Duitku sudah diinisialisasi. */
  private requireConfig() {
    if (!this.config) {
      throw new Error("Duitku not initialized");
    }

    return this.config;
  }

  /** Memastikan payload webhook berbentuk object. */
  private isRecord(payload: unknown): payload is Record<string, unknown> {
    return typeof payload === "object" && payload !== null;
  }
}
