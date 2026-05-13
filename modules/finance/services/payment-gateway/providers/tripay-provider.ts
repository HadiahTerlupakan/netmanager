import { logger } from "@/lib/logger";
import crypto from "crypto";
import { timingSafeCompare } from "./signature-compare.helpers";
import type {
  PaymentProvider,
  ProviderConfig,
  CreatePaymentParams,
  PaymentResult,
  TransactionStatus,
  WebhookResult,
  TestResult,
} from "../provider-interface";

export class TripayProvider implements PaymentProvider {
  name = "Tripay";
  private config: ProviderConfig | null = null;
  private baseUrl: string = "";

  initialize(config: ProviderConfig): void {
    this.config = config;
    this.baseUrl = config.isProduction
      ? "https://tripay.co.id/api"
      : "https://tripay.co.id/api-sandbox";
  }

  private getHeaders() {
    if (!this.config) throw new Error("Provider not initialized");
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  private generateSignature(payload: string): string {
    if (!this.config?.apiSecret)
      throw new Error("Private Key (API Secret) not configured");
    return crypto
      .createHmac("sha256", this.config.apiSecret)
      .update(payload)
      .digest("hex");
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    if (!this.config) throw new Error("Provider not initialized");

    try {
      // Tripay requires specific payload structure
      // We'll default to 'BRIVA' if no method specified, or use the first one
      const method = params.paymentMethods?.[0] || "BRIVA";

      // Calculate expiry time (Tripay expects unix timestamp)
      const expiryTime =
        Math.floor(Date.now() / 1000) + (params.expiryHours || 24) * 3600;

      const payload = {
        method,
        merchant_ref: params.orderId,
        amount: params.amount,
        customer_name: params.customerName,
        customer_email: params.customerEmail,
        customer_phone: params.customerPhone,
        order_items: [
          {
            sku: "TAGIHAN",
            name: params.description,
            price: params.amount,
            quantity: 1,
          },
        ],
        expired_time: expiryTime,
        signature: "", // Will be filled below
      };

      // Generate signature for transaction creation
      // Signature = HMAC_SHA256(merchant_code + merchant_ref + amount, private_key)
      const signaturePayload = `${this.config.merchantId}${params.orderId}${params.amount}`;
      payload.signature = this.generateSignature(signaturePayload);

      const response = await fetch(`${this.baseUrl}/transaction/create`, {
        method: "POST",
        headers: {
          ...this.getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: result.message || "Failed to create Tripay transaction",
        };
      }

      const data = result.data;

      return {
        success: true,
        paymentUrl: data.checkout_url,
        qrCodeUrl: data.qr_url, // For QRIS
        vaNumber: data.pay_code, // For VA
        bankCode: method,
        expiresAt: new Date(data.expired_time * 1000),
        transactionId: data.reference,
      };
    } catch (error: unknown) {
      logger.error("Tripay create payment error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to create payment";
      return {
        success: false,
        error: message,
      };
    }
  }

  async checkStatus(orderId: string): Promise<TransactionStatus> {
    if (!this.config) throw new Error("Provider not initialized");

    try {
      const response = await fetch(
        `${this.baseUrl}/transaction/detail?reference=${orderId}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to check status");
      }

      const data = result.data;
      let status: TransactionStatus["status"] = "PENDING";

      switch (data.status) {
        case "PAID":
          status = "PAID";
          break;
        case "EXPIRED":
          status = "EXPIRED";
          break;
        case "FAILED":
          status = "FAILED";
          break;
        case "REFUND":
          status = "CANCELLED";
          break;
      }

      return {
        orderId: data.merchant_ref,
        status,
        ...(data.paid_at ? { paidAt: new Date(data.paid_at * 1000) } : {}),
        paymentMethod: data.payment_method,
        amount: data.amount,
        transactionId: data.reference,
      };
    } catch (error: unknown) {
      logger.error("Tripay check status error:", error);
      throw error;
    }
  }

  async cancelPayment(_orderId: string): Promise<void> {
    // Tripay doesn't strictly support cancellation via API for open transactions in the same way,
    // but usually we just let them expire.
    // Implementing as no-op or check docs if specific endpoint exists.
    // For now, we'll leave it empty as it's not critical for the flow.
    return;
  }

  verifyWebhook(
    payload: Record<string, unknown> | string,
    signature?: string,
    rawBody?: string,
  ): boolean {
    if (!this.config?.apiSecret) return false;
    if (!signature) return false;

    const source =
      rawBody ?? (typeof payload === "string" ? payload : undefined);
    if (!source) return false;

    const calculatedSignature = crypto
      .createHmac("sha256", this.config.apiSecret)
      .update(source)
      .digest("hex");

    return timingSafeCompare(calculatedSignature, signature);
  }

  async processWebhook(
    payload: Record<string, unknown>,
  ): Promise<WebhookResult> {
    // Payload is the parsed JSON body from Tripay webhook

    let status: WebhookResult["status"] = "PENDING";

    switch (payload.status as string) {
      case "PAID":
        status = "PAID";
        break;
      case "EXPIRED":
        status = "EXPIRED";
        break;
      case "FAILED":
        status = "FAILED";
        break;
      case "REFUND":
        status = "CANCELLED";
        break;
    }

    return {
      orderId: payload.merchant_ref as string,
      status,
      ...(payload.paid_at
        ? { paidAt: new Date((payload.paid_at as number) * 1000) }
        : status === "PAID"
          ? { paidAt: new Date() }
          : {}),
      paymentMethod: payload.payment_method as string,
      transactionId: payload.reference as string,
      amount: payload.total_amount as number,
      raw: payload,
    };
  }

  async testConnection(): Promise<TestResult> {
    if (!this.config) {
      return { success: false, message: "Provider not initialized" };
    }

    try {
      // Test by fetching payment channels
      const response = await fetch(`${this.baseUrl}/merchant/payment-channel`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          message: "Connected to Tripay successfully",
          details: { channels: result.data?.length || 0 },
        };
      } else {
        return {
          success: false,
          message: result.message || "Failed to connect to Tripay",
        };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Koneksi gagal";
      return {
        success: false,
        message,
      };
    }
  }
}
