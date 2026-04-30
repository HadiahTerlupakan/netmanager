import { logger } from "@/lib/logger";
// BCA API Payment Provider Implementation
// Documentation: https://developer.bca.co.id/

import type {
  PaymentProvider,
  ProviderConfig,
  CreatePaymentParams,
  PaymentResult,
  TransactionStatus,
  WebhookResult,
  TestResult,
} from "../provider-interface";
import crypto from "crypto";

import {
  generateBcaSignature,
  normalizeBcaStatus,
  verifyBcaWebhookSignature,
} from "./bca-provider-utils";
import {
  buildVirtualAccountPaymentResult,
  buildVirtualAccountStatusResult,
  buildVirtualAccountWebhookResult,
  createVirtualAccountExpiryDate,
} from "./virtual-account-provider-helper";

export class BCAProvider implements PaymentProvider {
  name = "BCA API";
  private config?: ProviderConfig;
  private baseUrl?: string;

  initialize(config: ProviderConfig): void {
    this.config = config;
    // BCA API menggunakan base URL berbeda untuk sandbox dan production
    this.baseUrl = config.isProduction
      ? "https://api.bca.co.id" // Production URL
      : "https://sandbox.bca.co.id/api"; // Sandbox URL
  }

  /**
   * Generate BCA API OAuth2 access token
   * BCA menggunakan OAuth2 untuk authentication
   */
  private async getAccessToken(): Promise<string> {
    if (!this.config) {
      throw new Error("BCA provider not initialized");
    }

    try {
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${this.config.clientKey}:${this.config.apiSecret}`).toString("base64")}`,
        },
        body: "grant_type=client_credentials",
      });

      if (!response.ok) {
        throw new Error("Failed to get BCA access token");
      }

      const data = (await response.json()) as { access_token: string };
      return data.access_token;
    } catch (error: unknown) {
      logger.error("BCA getAccessToken error:", error);
      throw error;
    }
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      if (!this.config || !this.baseUrl) {
        throw new Error("BCA provider not initialized");
      }

      // Get access token
      const accessToken = await this.getAccessToken();

      const expiryDate = createVirtualAccountExpiryDate(params.expiryHours);

      // Prepare request body - CUSTOMIZE based on BCA API documentation
      // BCA Virtual Account creation
      const requestBody = {
        CompanyCode: this.config.merchantId, // Your BCA company code
        PrimaryAccountNumber: params.orderId.substring(0, 12), // Max 12 digits
        CorporateID: this.config.merchantId,
        CustomerID: params.orderId,
        CustomerName: params.customerName.substring(0, 50), // Max 50 chars
        ExpiredDate: (expiryDate.toISOString().split("T")[0] ?? "").replace(
          /-/g,
          "",
        ), // Format: YYYYMMDD
        TotalAmount: {
          Value: params.amount.toFixed(2),
          Currency: "IDR",
        },
        AdditionalInfo: {
          Description: params.description.substring(0, 100), // Max 100 chars
        },
      };

      const bodyString = JSON.stringify(requestBody);
      const timestamp = new Date().toISOString();
      const url = "/va/payments"; // Adjust based on actual BCA endpoint

      const signature = generateBcaSignature({
        method: "POST",
        relativeUrl: url,
        accessToken,
        body: bodyString,
        timestamp,
        apiSecret: this.config.apiSecret || "",
      });

      // Make API request
      const response = await fetch(`${this.baseUrl}${url}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-BCA-Key": this.config.apiKey || "",
          "X-BCA-Timestamp": timestamp,
          "X-BCA-Signature": signature,
          Origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-BCA-CorrelationID": crypto.randomUUID(),
        },
        body: bodyString,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.ErrorMessage || "Failed to create BCA VA");
      }

      const data = await response.json();

      return buildVirtualAccountPaymentResult({
        transactionId: data.TransactionID,
        fallbackTransactionId: params.orderId,
        vaNumber: data.VirtualAccountNumber,
        paymentPath: `/payment/bca/${data.VirtualAccountNumber}`,
        expiresAt: expiryDate,
      });
    } catch (error: unknown) {
      logger.error("BCA createPayment error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create payment";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async checkStatus(orderId: string): Promise<TransactionStatus> {
    try {
      if (!this.config || !this.baseUrl) {
        throw new Error("BCA provider not initialized");
      }

      const accessToken = await this.getAccessToken();
      const timestamp = new Date().toISOString();
      const url = `/va/payments/${this.config.merchantId}/${orderId}`; // Adjust based on actual endpoint

      const signature = generateBcaSignature({
        method: "GET",
        relativeUrl: url,
        accessToken,
        body: "",
        timestamp,
        apiSecret: this.config.apiSecret || "",
      });

      const response = await fetch(`${this.baseUrl}${url}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-BCA-Key": this.config.apiKey || "",
          "X-BCA-Timestamp": timestamp,
          "X-BCA-Signature": signature,
          "X-BCA-CorrelationID": crypto.randomUUID(),
        },
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

      const status = normalizeBcaStatus({
        transactionStatus: data.TransactionStatus,
        paidStatus: data.PaidStatus,
      });

      return buildVirtualAccountStatusResult({
        orderId,
        status,
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

  async cancelPayment(_orderId: string): Promise<void> {
    // BCA Virtual Account biasanya tidak support cancel, akan expired otomatis
  }

  verifyWebhook(payload: Record<string, unknown>, signature?: string): boolean {
    try {
      if (!this.config || !signature) {
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

  async processWebhook(
    payload: Record<string, unknown>,
  ): Promise<WebhookResult> {
    try {
      const orderId =
        (payload.CustomerID as string) || (payload.TransactionID as string);
      const status = normalizeBcaStatus({
        transactionStatus: payload.TransactionStatus,
        paidStatus: payload.PaidStatus,
      });

      return buildVirtualAccountWebhookResult({
        orderId,
        status,
        paidAt: payload.PaidDate as string | undefined,
        paymentMethod: "BCA Virtual Account",
        transactionId: payload.TransactionID as string,
        amount: (payload.TotalAmount as { Value?: string })?.Value,
        raw: payload,
      });
    } catch (error: unknown) {
      logger.error("BCA processWebhook error:", error);
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

      // Test by getting access token
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

      return {
        success: false,
        message: "Gagal mendapatkan access token",
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Koneksi gagal";
      const errorCode = (error as { code?: string })?.code;
      return {
        success: false,
        message: errorMessage,
        details: {
          error: errorCode,
        },
      };
    }
  }
}
