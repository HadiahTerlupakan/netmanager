import { logger } from "@/lib/logger";
import { getAppUrl } from "@/lib/utils/env";
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
  buildXenditWebhookResult,
  hasXenditMatchingToken,
  mapXenditStatus,
  resolveXenditCallbackToken,
  resolveXenditStoredCallbackToken,
} from "./xendit-provider-helpers";

export class XenditProvider implements PaymentProvider {
  name = "Xendit";
  private config?: ProviderConfig;
  private xendit: unknown = null;
  private xenditPromise: Promise<unknown> | null = null;

  initialize(config: ProviderConfig): void {
    this.config = config;
  }

  /** Lazy-load SDK Xendit saat pertama kali dibutuhkan. */
  private async getXenditInstance(): Promise<unknown> {
    if (this.xendit) return this.xendit;

    if (!this.xenditPromise) {
      this.xenditPromise = import("xendit-node").then(({ default: Xendit }) => {
        this.xendit = new Xendit({ secretKey: this.config!.apiKey });
        return this.xendit;
      });
    }

    return this.xenditPromise;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      const invoiceApi = await this.getInvoiceApi();
      const invoice = await invoiceApi.createInvoice({
        externalId: params.orderId,
        amount: params.amount,
        description: params.description,
        invoiceDuration: (params.expiryHours || 24) * 3600,
        currency: "IDR",
        payerEmail: params.customerEmail || undefined,
        customer: {
          givenNames: params.customerName,
          email: params.customerEmail,
          mobileNumber: params.customerPhone,
        },
        successRedirectUrl: `${getAppUrl()}/payment/success`,
        failureRedirectUrl: `${getAppUrl()}/payment/failed`,
      });

      return {
        success: true,
        paymentUrl: invoice.invoice_url,
        transactionId: invoice.id,
        expiresAt: new Date(invoice.expiry_date),
      };
    } catch (error: unknown) {
      logger.error("Xendit createPayment error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create payment",
      };
    }
  }

  async checkStatus(orderId: string): Promise<TransactionStatus> {
    try {
      const invoiceApi = await this.getInvoiceApi();
      const invoices = await invoiceApi.getInvoices({
        externalId: orderId,
        limit: 1,
      });
      const invoice = invoices[0];

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      return {
        orderId,
        status: mapXenditStatus(invoice.status),
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
      const invoiceApi = await this.getInvoiceApi();
      const invoices = await invoiceApi.getInvoices({
        externalId: orderId,
        limit: 1,
      });
      const invoice = invoices[0];

      if (invoice) {
        await invoiceApi.expireInvoice({ invoiceId: invoice.id });
      }
    } catch (error: unknown) {
      logger.error("Xendit cancelPayment error:", error);
      throw error;
    }
  }

  verifyWebhook(payload: unknown, signature?: string): boolean {
    try {
      if (!this.isRecord(payload)) {
        return false;
      }

      const callbackToken = resolveXenditCallbackToken(payload, signature);
      const storedToken = resolveXenditStoredCallbackToken(this.config);

      if (!callbackToken || !storedToken) {
        return false;
      }

      return hasXenditMatchingToken(callbackToken, storedToken);
    } catch (error) {
      logger.error("Xendit webhook verification error:", error);
      return false;
    }
  }

  async processWebhook(payload: unknown): Promise<WebhookResult> {
    if (!this.isRecord(payload)) {
      throw new Error("Invalid Xendit webhook payload");
    }

    try {
      return buildXenditWebhookResult(payload);
    } catch (error: unknown) {
      logger.error("Xendit processWebhook error:", error);
      throw error;
    }
  }

  async testConnection(): Promise<TestResult> {
    try {
      if (!this.config) {
        return { success: false, message: "Provider not initialized" };
      }

      const { default: Xendit } = await import("xendit-node");
      const testXendit = new Xendit({ secretKey: this.config.apiKey });
      const { Balance } = testXendit as unknown as {
        Balance: {
          getBalance: (params: {
            accountType: string;
          }) => Promise<{ balance: number; currency?: string }>;
        };
      };
      const balance = await Balance.getBalance({ accountType: "CASH" });

      return {
        success: true,
        message: "Connection successful",
        details: {
          balance: balance.balance,
          currency: balance.currency || "IDR",
        },
      };
    } catch (error: unknown) {
      const err = error as { error_code?: string; code?: string };
      return {
        success: false,
        message: error instanceof Error ? error.message : "Koneksi gagal",
        details: { error: err.error_code || err.code },
      };
    }
  }

  private async getInvoiceApi() {
    await this.getXenditInstance();

    if (!this.xendit) {
      throw new Error("Xendit not initialized");
    }

    return (
      this.xendit as {
        Invoice: {
          createInvoice: (params: unknown) => Promise<{
            invoice_url: string;
            id: string;
            expiry_date: string;
          }>;
          getInvoices: (params: unknown) => Promise<
            Array<{
              status: string;
              paid_at?: string;
              payment_method: string;
              amount: number;
              id: string;
            }>
          >;
          expireInvoice: (params: { invoiceId: string }) => Promise<void>;
        };
      }
    ).Invoice;
  }

  private isRecord(payload: unknown): payload is Record<string, unknown> {
    return typeof payload === "object" && payload !== null;
  }
}
