import { logger } from "@/lib/logger";
// Xendit Payment Provider Implementation

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

export class XenditProvider implements PaymentProvider {
  name = "Xendit";
  private config?: ProviderConfig;
  private xendit: unknown = null;

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;

    // Initialize Xendit SDK
    const { default: Xendit } = await import("xendit-node");
    this.xendit = new Xendit({
      secretKey: config.apiKey,
    });
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      if (!this.xendit) {
        throw new Error("Xendit not initialized");
      }

      const { Invoice } = this.xendit as {
        Invoice: {
          createInvoice: (
            params: unknown,
          ) => Promise<{
            invoice_url: string;
            id: string;
            expiry_date: string;
          }>;
        };
      };

      // Calculate expiry time (default 24 hours)
      const expiryHours = params.expiryHours || 24;
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + expiryHours);

      // Create invoice
      const invoice = await Invoice.createInvoice({
        externalId: params.orderId,
        amount: params.amount,
        description: params.description,
        invoiceDuration: expiryHours * 3600, // Convert to seconds
        currency: "IDR",
        payerEmail: params.customerEmail || undefined,
        customer: {
          givenNames: params.customerName,
          email: params.customerEmail,
          mobileNumber: params.customerPhone,
        },
        successRedirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
        failureRedirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/failed`,
      });

      return {
        success: true,
        paymentUrl: invoice.invoice_url,
        transactionId: invoice.id,
        expiresAt: new Date(invoice.expiry_date),
      };
    } catch (error: unknown) {
      logger.error("Xendit createPayment error:", error);
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
      if (!this.xendit) {
        throw new Error("Xendit not initialized");
      }

      const { Invoice } = this.xendit as {
        Invoice: {
          getInvoices: (
            params: unknown,
          ) => Promise<
            Array<{
              status: string;
              paid_at?: string;
              payment_method: string;
              amount: number;
              id: string;
            }>
          >;
        };
      };

      // Get invoice by external ID
      const invoices = await Invoice.getInvoices({
        externalId: orderId,
        limit: 1,
      });

      if (!invoices || invoices.length === 0) {
        throw new Error("Invoice not found");
      }

      const invoice = invoices[0];

      // Map Xendit status to our status
      let status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "FAILED";
      switch (invoice.status) {
        case "PAID":
        case "SETTLED":
          status = "PAID";
          break;
        case "EXPIRED":
          status = "EXPIRED";
          break;
        case "PENDING":
          status = "PENDING";
          break;
        default:
          status = "FAILED";
      }

      return {
        orderId,
        status,
        ...(invoice.paid_at ? { paidAt: new Date(invoice.paid_at) } : {}),
        paymentMethod: invoice.payment_method,
        amount: invoice.amount,
        transactionId: invoice.id,
      };
    } catch (error: unknown) {
      logger.error("Xendit checkStatus error:", error);
      throw error;
    }
  }

  async cancelPayment(orderId: string): Promise<void> {
    try {
      if (!this.xendit) {
        throw new Error("Xendit not initialized");
      }

      const { Invoice } = this.xendit as {
        Invoice: {
          getInvoices: (params: unknown) => Promise<Array<{ id: string }>>;
          expireInvoice: (params: { invoiceId: string }) => Promise<void>;
        };
      };

      // Get invoice first
      const invoices = await Invoice.getInvoices({
        externalId: orderId,
        limit: 1,
      });

      if (invoices && invoices.length > 0) {
        await Invoice.expireInvoice({
          invoiceId: invoices[0].id,
        });
      }
    } catch (error: unknown) {
      logger.error("Xendit cancelPayment error:", error);
      throw error;
    }
  }

  verifyWebhook(payload: Record<string, unknown>, signature?: string): boolean {
    try {
      if (!this.config) {
        return false;
      }

      // Xendit uses callback token for verification
      // The token comes from request header 'x-callback-token' (passed as signature)
      // or from payload itself
      const callbackToken =
        signature || (payload["x-callback-token"] as string);

      if (!callbackToken) {
        return false;
      }

      // Compare against stored callback verification token from settings
      const storedToken =
        (this.config.settings?.callbackToken as string) ||
        this.config.apiSecret ||
        this.config.apiKey;

      if (!storedToken) {
        logger.warn("Xendit: No callback token configured for verification");
        return false;
      }

      // Use timing-safe comparison to prevent timing attacks
      const tokenBuffer = Buffer.from(callbackToken);
      const storedBuffer = Buffer.from(storedToken);

      if (tokenBuffer.length !== storedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(tokenBuffer, storedBuffer);
    } catch (error) {
      logger.error("Xendit webhook verification error:", error);
      return false;
    }
  }

  async processWebhook(
    payload: Record<string, unknown>,
  ): Promise<WebhookResult> {
    try {
      const orderId = payload.external_id as string;

      // Map Xendit status
      let status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "FAILED";
      switch (payload.status as string) {
        case "PAID":
        case "SETTLED":
          status = "PAID";
          break;
        case "EXPIRED":
          status = "EXPIRED";
          break;
        case "PENDING":
          status = "PENDING";
          break;
        default:
          status = "FAILED";
      }

      return {
        orderId,
        status,
        ...(payload.paid_at
          ? { paidAt: new Date(payload.paid_at as string) }
          : {}),
        paymentMethod: payload.payment_method as string,
        transactionId: payload.id as string,
        amount: payload.amount as number,
        raw: payload,
      };
    } catch (error: unknown) {
      logger.error("Xendit processWebhook error:", error);
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

      // Initialize with test credentials
      const { default: Xendit } = await import("xendit-node");
      const testXendit = new Xendit({
        secretKey: this.config.apiKey,
      });

      // Try to get balance (this will validate the API key)
      const { Balance } = testXendit as unknown as {
        Balance: {
          getBalance: (params: {
            accountType: string;
          }) => Promise<{ balance: number; currency?: string }>;
        };
      };
      const balance = await Balance.getBalance({
        accountType: "CASH",
      });

      return {
        success: true,
        message: "Connection successful",
        details: {
          balance: balance.balance,
          currency: balance.currency || "IDR",
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Koneksi gagal";
      const err = error as { error_code?: string; code?: string };
      return {
        success: false,
        message,
        details: {
          error: err.error_code || err.code,
        },
      };
    }
  }
}
