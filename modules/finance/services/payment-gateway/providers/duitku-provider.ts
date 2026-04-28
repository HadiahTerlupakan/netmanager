import { logger } from "@/lib/logger";
// Duitku Payment Provider Implementation

import crypto from "crypto";
import type {
  PaymentProvider,
  ProviderConfig,
  CreatePaymentParams,
  PaymentResult,
  TransactionStatus,
  WebhookResult,
  TestResult,
} from "../provider-interface";

export class DuitkuProvider implements PaymentProvider {
  name = "Duitku";
  private config?: ProviderConfig;
  private baseUrl: string = "";

  initialize(config: ProviderConfig): void {
    this.config = config;

    // Set base URL based on environment
    this.baseUrl = config.isProduction
      ? "https://passport.duitku.com/webapi/api"
      : "https://sandbox.duitku.com/webapi/api";
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      if (!this.config) {
        throw new Error("Duitku not initialized");
      }

      const merchantCode = this.config.merchantId || "";
      const apiKey = this.config.apiKey;
      const merchantOrderId = params.orderId;
      const paymentAmount = params.amount;

      // Calculate expiry time (default 24 hours)
      const expiryHours = params.expiryHours || 24;
      const expiryMinutes = expiryHours * 60;

      // Create signature for request
      const signature = crypto
        .createHash("md5")
        .update(`${merchantCode}${merchantOrderId}${paymentAmount}${apiKey}`)
        .digest("hex");

      const requestBody = {
        merchantCode,
        paymentAmount,
        paymentMethod: params.paymentMethods?.[0] || "VC", // Use requested method or default to Virtual Account
        merchantOrderId,
        productDetails: params.description,
        merchantUserInfo: params.customerName,
        customerVaName: params.customerName,
        email: params.customerEmail,
        phoneNumber: params.customerPhone,
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/duitku`,
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
        signature,
        expiryPeriod: expiryMinutes,
      };

      const response = await fetch(`${this.baseUrl}/merchant/createinvoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (result.statusCode === "00") {
        return {
          success: true,
          paymentUrl: result.paymentUrl,
          vaNumber: result.vaNumber,
          transactionId: result.reference,
          expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
        };
      } else {
        return {
          success: false,
          error: result.statusMessage || "Failed to create payment",
        };
      }
    } catch (error: unknown) {
      logger.error("Duitku createPayment error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to create payment";
      return {
        success: false,
        error: message,
      };
    }
  }

  async checkStatus(orderId: string): Promise<TransactionStatus> {
    try {
      if (!this.config) {
        throw new Error("Duitku not initialized");
      }

      const merchantCode = this.config.merchantId || "";
      const apiKey = this.config.apiKey;

      // Create signature for status check
      const signature = crypto
        .createHash("md5")
        .update(`${merchantCode}${orderId}${apiKey}`)
        .digest("hex");

      const response = await fetch(
        `${this.baseUrl}/merchant/transactionStatus`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            merchantCode,
            merchantOrderId: orderId,
            signature,
          }),
        },
      );

      const result = await response.json();

      // Map Duitku status codes to our status
      let status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "FAILED";
      switch (result.statusCode) {
        case "00": // Success
          status = "PAID";
          break;
        case "01": // Pending
          status = "PENDING";
          break;
        case "02": // Expired
          status = "EXPIRED";
          break;
        case "03": // Failed/Cancelled
          status = "CANCELLED";
          break;
        default:
          status = "FAILED";
      }

      return {
        orderId,
        status,
        ...(result.statusCode === "00"
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

  async cancelPayment(_orderId: string): Promise<void> {
    // Duitku doesn't have explicit cancel endpoint
    // Transactions automatically expire after expiry period
  }

  verifyWebhook(
    payload: Record<string, unknown>,
    _signature?: string,
  ): boolean {
    try {
      if (!this.config) {
        return false;
      }

      const merchantCode = this.config.merchantId || "";
      const apiKey = this.config.apiKey;
      const amount = payload.amount as string;
      const merchantOrderId = payload.merchantOrderId as string;

      // Calculate expected signature
      const expectedSignature = crypto
        .createHash("md5")
        .update(`${merchantCode}${amount}${merchantOrderId}${apiKey}`)
        .digest("hex");

      return payload.signature === expectedSignature;
    } catch (error) {
      logger.error("Duitku webhook verification error:", error);
      return false;
    }
  }

  async processWebhook(
    payload: Record<string, unknown>,
  ): Promise<WebhookResult> {
    try {
      const orderId = payload.merchantOrderId as string;

      // Map Duitku result codes
      let status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "FAILED";
      switch (payload.resultCode as string) {
        case "00": // Success
          status = "PAID";
          break;
        case "01": // Pending
          status = "PENDING";
          break;
        case "02": // Expired
          status = "EXPIRED";
          break;
        case "03": // Failed/Cancelled
          status = "CANCELLED";
          break;
        default:
          status = "FAILED";
      }

      return {
        orderId,
        status,
        ...(status === "PAID" ? { paidAt: new Date() } : {}),
        paymentMethod: payload.paymentCode as string,
        transactionId: payload.reference as string,
        amount: parseFloat(payload.amount as string),
        raw: payload,
      };
    } catch (error: unknown) {
      logger.error("Duitku processWebhook error:", error);
      throw error;
    }
  }

  async testConnection(): Promise<TestResult> {
    try {
      if (!this.config) {
        return {
          success: false,
          message: "Provider not initialized",
        };
      }

      const merchantCode = this.config.merchantId || "";
      const apiKey = this.config.apiKey;

      // Test with status inquiry for a dummy transaction
      const testOrderId = "TEST-" + Date.now();
      const signature = crypto
        .createHash("md5")
        .update(`${merchantCode}${testOrderId}${apiKey}`)
        .digest("hex");

      const response = await fetch(
        `${this.baseUrl}/merchant/transactionStatus`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            merchantCode,
            merchantOrderId: testOrderId,
            signature,
          }),
        },
      );

      const result = await response.json();

      // If we get a response (even if transaction not found), credentials are valid
      if (result.statusCode || result.statusMessage) {
        return {
          success: true,
          message: "Connection successful",
          details: {
            merchantCode,
            environment: this.config.isProduction ? "Production" : "Sandbox",
          },
        };
      } else {
        return {
          success: false,
          message: "Respon tidak valid dari Duitku API",
        };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Koneksi gagal";
      return {
        success: false,
        message,
        details: {
          error: (error as Record<string, unknown>)?.code,
        },
      };
    }
  }
}
