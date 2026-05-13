import { logger } from "@/lib/logger";
import * as crypto from "crypto";
import midtransClient from "midtrans-client";
import { timingSafeCompare } from "./signature-compare.helpers";
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
  buildMidtransCoreApi,
  buildMidtransWebhookResult,
  mapMidtransStatus,
  testMidtransConnection,
} from "./midtrans-provider-helpers";

export class MidtransProvider implements PaymentProvider {
  name = "Midtrans";
  private config?: ProviderConfig;
  private snap: unknown = null;
  private coreApi: unknown = null;

  /** Inisialisasi client Snap dan Core API Midtrans. */
  initialize(config: ProviderConfig): void {
    this.config = config;
    this.snap = new midtransClient.Snap({
      isProduction: config.isProduction,
      serverKey: config.apiKey,
      clientKey: config.clientKey,
    });
    this.coreApi = buildMidtransCoreApi(config);
  }

  /** Membuat transaksi pembayaran Midtrans. */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      const transaction = await this.getSnapApi().createTransaction({
        transaction_details: {
          order_id: params.orderId,
          gross_amount: params.amount,
        },
        customer_details: {
          first_name: params.customerName,
          email: params.customerEmail,
          phone: params.customerPhone,
        },
        item_details: [
          {
            id: "INVOICE",
            name: params.description,
            price: params.amount,
            quantity: 1,
          },
        ],
        callbacks: {
          finish: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
          error: `${process.env.NEXT_PUBLIC_APP_URL}/payment/failed`,
          pending: `${process.env.NEXT_PUBLIC_APP_URL}/payment/pending`,
        },
      });

      return {
        success: true,
        paymentUrl: transaction.redirect_url,
        transactionId: transaction.token,
        expiresAt: new Date(
          Date.now() + (params.expiryHours || 24) * 60 * 60 * 1000,
        ),
      };
    } catch (error: unknown) {
      logger.error("Midtrans createPayment error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create payment",
      };
    }
  }

  /** Mengecek status transaksi Midtrans. */
  async checkStatus(orderId: string): Promise<TransactionStatus> {
    try {
      const statusResponse = await this.getCoreTransactionApi().status(orderId);
      const status = mapMidtransStatus(statusResponse.transaction_status);

      return {
        orderId,
        status,
        ...(status === "PAID"
          ? { paidAt: new Date(statusResponse.transaction_time) }
          : {}),
        paymentMethod: statusResponse.payment_type,
        amount: parseFloat(statusResponse.gross_amount),
        transactionId: statusResponse.transaction_id,
      };
    } catch (error: unknown) {
      logger.error("Midtrans checkStatus error:", error);
      throw error;
    }
  }

  /** Membatalkan transaksi Midtrans. */
  async cancelPayment(orderId: string): Promise<void> {
    try {
      await this.getCoreTransactionApi().cancel(orderId);
    } catch (error: unknown) {
      logger.error("Midtrans cancelPayment error:", error);
      throw error;
    }
  }

  /** Memverifikasi signature webhook Midtrans. */
  verifyWebhook(payload: unknown, _signature?: string): boolean {
    try {
      if (!this.config || !this.isRecord(payload)) {
        return false;
      }

      const hash = crypto
        .createHash("sha512")
        .update(
          `${payload.order_id as string}${payload.status_code as string}${payload.gross_amount as string}${this.config.apiKey}`,
        )
        .digest("hex");

      return timingSafeCompare(hash, payload.signature_key as string);
    } catch (error) {
      logger.error("Midtrans webhook verification error:", error);
      return false;
    }
  }

  /** Menormalkan payload webhook Midtrans. */
  async processWebhook(payload: unknown): Promise<WebhookResult> {
    if (!this.isRecord(payload)) {
      throw new Error("Invalid Midtrans webhook payload");
    }

    try {
      return buildMidtransWebhookResult(payload);
    } catch (error: unknown) {
      logger.error("Midtrans processWebhook error:", error);
      throw error;
    }
  }

  /** Mengetes koneksi credential Midtrans. */
  async testConnection(): Promise<TestResult> {
    try {
      if (!this.config) {
        return { success: false, message: "Provider not initialized" };
      }

      return await testMidtransConnection(this.config);
    } catch (error: unknown) {
      const err = error as Record<string, unknown>;
      return {
        success: false,
        message: error instanceof Error ? error.message : "Koneksi gagal",
        details: {
          error: (err.code as string) || (err.error_code as string),
        },
      };
    }
  }

  /** Mengambil API Snap dari SDK Midtrans. */
  private getSnapApi() {
    if (!this.snap) {
      throw new Error("Midtrans not initialized");
    }

    return this.snap as {
      createTransaction: (
        payload: unknown,
      ) => Promise<{ redirect_url: string; token: string }>;
    };
  }

  /** Mengambil API transaction dari Core API Midtrans. */
  private getCoreTransactionApi() {
    if (!this.coreApi) {
      throw new Error("Midtrans not initialized");
    }

    return (
      this.coreApi as {
        transaction: {
          status: (id: string) => Promise<{
            transaction_status: string;
            transaction_time: string;
            payment_type: string;
            gross_amount: string;
            transaction_id: string;
          }>;
          cancel: (id: string) => Promise<void>;
        };
      }
    ).transaction;
  }

  /** Memastikan payload webhook berbentuk object. */
  private isRecord(payload: unknown): payload is Record<string, unknown> {
    return typeof payload === "object" && payload !== null;
  }
}
