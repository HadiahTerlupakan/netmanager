import { InvoiceStatus } from "@prisma/client-billing";
import type {
  GatewayPaymentStatus,
  PaymentMethod,
  Prisma,
} from "@prisma/client-billing";

import { prismaBillingAuth } from "@/lib/prisma-billing";
import { parseOptionalDate } from "@/lib/utils/server-datetime";
import { InvoiceRepository } from "../../repositories/InvoiceRepository";
import { PaymentRepository } from "../../repositories/PaymentRepository";
import { UnmatchedMutationRepository } from "../../repositories/UnmatchedMutationRepository";
import { AutomaticBillingService } from "../AutomaticBillingService";

import { PaymentGatewayManager } from "./gateway-manager";
import type { WebhookResult } from "./provider-interface";

const SIGNATURE_HEADERS = {
  XENDIT: "x-callback-token",
  MIDTRANS: "",
  TRIPAY: "x-callback-signature",
  DUITKU: "",
  BRI: "x-signature",
  BCA: "x-bca-signature",
  DANA: "x-dana-signature",
  MOOTA: "signature",
} as const;

type SupportedProvider = keyof typeof SIGNATURE_HEADERS;

type ProcessWebhookInput = {
  providerType: string;
  rawBody: string;
  headers: Headers;
  tenantId?: string | null;
};

export type ProcessWebhookResult = {
  status: number;
  body: { status?: string; error?: string; message?: string };
};

const GATEWAY_STATUS_MAP: Record<
  WebhookResult["status"],
  GatewayPaymentStatus
> = {
  PAID: "PAID",
  PENDING: "PENDING",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
};

const PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  CASH: "CASH",
  BANK_TRANSFER: "BANK_TRANSFER",
  BANK: "BANK_TRANSFER",
  VA: "BANK_TRANSFER",
  EWALLET: "E_WALLET",
  E_WALLET: "E_WALLET",
  CREDIT_CARD: "CREDIT_CARD",
  CARD: "CREDIT_CARD",
  DEBIT_CARD: "DEBIT_CARD",
  CHECK: "CHECK",
  OTHER: "OTHER",
};

type BillingTx = Prisma.TransactionClient;

export class WebhookProcessingService {
  private readonly gatewayManager: PaymentGatewayManager;
  private readonly paymentRepository: PaymentRepository;
  private readonly invoiceRepository: InvoiceRepository;
  private readonly unmatchedMutationRepository: UnmatchedMutationRepository;

  constructor(dependencies?: {
    gatewayManager?: PaymentGatewayManager;
    paymentRepository?: PaymentRepository;
    invoiceRepository?: InvoiceRepository;
    unmatchedMutationRepository?: UnmatchedMutationRepository;
  }) {
    this.gatewayManager =
      dependencies?.gatewayManager ?? new PaymentGatewayManager();
    this.paymentRepository =
      dependencies?.paymentRepository ?? new PaymentRepository();
    this.invoiceRepository =
      dependencies?.invoiceRepository ?? new InvoiceRepository();
    this.unmatchedMutationRepository =
      dependencies?.unmatchedMutationRepository ??
      new UnmatchedMutationRepository();
  }

  /** Memproses webhook payment gateway dan merekonsiliasi status pembayaran. */
  async process(input: ProcessWebhookInput): Promise<ProcessWebhookResult> {
    const providerType = input.providerType.toUpperCase();

    if (!this.isSupportedProvider(providerType)) {
      console.warn(`[Webhook] Unknown provider: ${providerType}`);
      return {
        status: 400,
        body: { error: "Unknown payment provider" },
      };
    }

    const payload = this.parsePayload(input.rawBody, providerType);
    if (!payload) {
      return {
        status: 400,
        body: { error: "Invalid request body" },
      };
    }

    try {
      const signature = this.extractSignature(providerType, input.headers);
      let payment = await this.findPaymentByEarlyOrderId(
        providerType,
        payload,
        input.tenantId,
      );

      const webhookResult = await this.gatewayManager.processWebhook(
        providerType,
        payload,
        signature,
        input.rawBody,
        payment?.tenantId || undefined,
      );

      const gatewayStatus =
        GATEWAY_STATUS_MAP[webhookResult.status] ?? "FAILED";

      if (!payment) {
        payment = await this.findPaymentAfterWebhook(
          providerType,
          webhookResult,
          input.tenantId,
        );
      }

      if (
        payment &&
        this.hasAmountMismatch(payment.amount, webhookResult.amount)
      ) {
        console.warn(
          `[Webhook] Amount mismatch for payment ${payment.id}: expected ${payment.amount}, received ${webhookResult.amount}`,
        );
        return {
          status: 200,
          body: { status: "ok", message: "Payment amount mismatch" },
        };
      }

      if (!payment) {
        await this.recordUnmatchedMutationForMoota(providerType, webhookResult);
        console.warn(
          `[Webhook] Payment not found for ${providerType === "MOOTA" ? `amount: ${webhookResult.amount}` : `orderId: ${webhookResult.orderId}`}`,
        );
        return {
          status: 200,
          body: { status: "ok", message: "Payment record not found" },
        };
      }

      if (
        this.hasTransactionMismatch(
          payment.transactionId,
          webhookResult.transactionId,
        )
      ) {
        console.warn(
          `[Webhook] Transaction mismatch for payment ${payment.id}: expected ${payment.transactionId}, received ${webhookResult.transactionId}`,
        );
        return {
          status: 200,
          body: { status: "ok", message: "Payment transaction mismatch" },
        };
      }

      if (payment.gatewayStatus === "PAID") {
        return {
          status: 200,
          body: { status: "ok", message: "Already processed" },
        };
      }

      await prismaBillingAuth.$transaction(async (tx) => {
        const currentPayment = await tx.payment.findUnique({
          where: { id: payment.id },
        });
        if (currentPayment?.gatewayStatus === "PAID") {
          return;
        }

        if (
          this.hasTransactionMismatch(
            currentPayment?.transactionId ?? null,
            webhookResult.transactionId,
          )
        ) {
          return;
        }

        const paymentUpdate: Prisma.PaymentUpdateInput = {
          gatewayStatus,
          transactionId:
            webhookResult.transactionId ||
            currentPayment?.transactionId ||
            null,
          gatewayProvider: providerType,
        };

        const normalizedPaymentMethod = this.normalizePaymentMethod(
          webhookResult.paymentMethod,
        );
        if (normalizedPaymentMethod) {
          paymentUpdate.paymentMethod = normalizedPaymentMethod;
        }

        if (webhookResult.paidAt) {
          paymentUpdate.paymentDate = webhookResult.paidAt;
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: paymentUpdate,
        });

        if (gatewayStatus === "PAID") {
          await this.updateInvoicesOnPaymentTx(tx, payment.id, payment.notes);
        }
      });

      if (gatewayStatus === "PAID") {
        await this.runPostPaidSideEffects(payment.invoiceId, payment.notes);
      }

      if (
        gatewayStatus === "EXPIRED" ||
        gatewayStatus === "CANCELLED" ||
        gatewayStatus === "FAILED"
      ) {
      }

      return {
        status: 200,
        body: { status: "ok" },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[Webhook] Error processing ${providerType}:`,
        err.message,
        err.stack,
      );

      if (err.message.includes("Invalid webhook signature")) {
        return {
          status: 401,
          body: { status: "error", message: "Invalid signature" },
        };
      }

      return {
        status: 500,
        body: { status: "error", message: "Internal server error" },
      };
    }
  }

  private isSupportedProvider(
    providerType: string,
  ): providerType is SupportedProvider {
    return providerType in SIGNATURE_HEADERS;
  }

  private extractSignature(
    providerType: SupportedProvider,
    headers: Headers,
  ): string | undefined {
    const signatureHeader = SIGNATURE_HEADERS[providerType];
    if (!signatureHeader) {
      return undefined;
    }

    return headers.get(signatureHeader) ?? undefined;
  }

  private parsePayload(
    rawBody: string,
    providerType: string,
  ): Record<string, unknown> | null {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      try {
        const searchParams = new URLSearchParams(rawBody);
        const payload = Object.fromEntries(searchParams.entries());
        if (Object.keys(payload).length === 0 && rawBody.length > 0) {
          throw new Error("Fallback URLSearchParams yielded empty result");
        }
        return payload;
      } catch {
        console.error(
          `[Webhook] Invalid body from ${providerType}: Not JSON or Form-Urlencoded`,
        );
        return null;
      }
    }
  }

  private async findPaymentByEarlyOrderId(
    providerType: SupportedProvider,
    payload: Record<string, unknown>,
    tenantId?: string | null,
  ) {
    const earlyOrderId = this.extractEarlyOrderId(providerType, payload);
    if (!earlyOrderId || providerType === "MOOTA") {
      return null;
    }

    return this.paymentRepository.findFirstAuth(
      this.buildPaymentLookupWhere(earlyOrderId, tenantId),
    );
  }

  private extractEarlyOrderId(
    providerType: SupportedProvider,
    payload: Record<string, unknown>,
  ): string | undefined {
    const reader = (field: string): string | undefined => {
      const value = payload[field];
      return typeof value === "string" && value.trim().length > 0
        ? value
        : undefined;
    };

    switch (providerType) {
      case "MIDTRANS":
        return reader("order_id");
      case "XENDIT":
        return reader("external_id");
      case "TRIPAY":
        return reader("merchant_ref");
      case "DUITKU":
        return reader("merchantOrderId");
      case "BRI":
        return reader("custCode") || reader("brivaNo");
      case "BCA":
        return reader("CustomerID") || reader("TransactionID");
      case "DANA":
        return reader("merchantOrderId") || reader("orderId");
      case "MOOTA":
        return undefined;
      default:
        return undefined;
    }
  }

  private async findPaymentAfterWebhook(
    providerType: SupportedProvider,
    webhookResult: WebhookResult,
    tenantId?: string | null,
  ) {
    if (providerType === "MOOTA") {
      return null;
    }

    return this.paymentRepository.findFirstAuth(
      this.buildPaymentLookupWhere(webhookResult.orderId, tenantId),
    );
  }

  private buildPaymentLookupWhere(
    reference: string | undefined,
    tenantId?: string | null,
  ): Prisma.PaymentWhereInput {
    const paymentReference = reference ?? "__missing_reference__";

    if (!tenantId) {
      return { reference: paymentReference };
    }

    return { reference: paymentReference, tenantId };
  }

  private async recordUnmatchedMutationForMoota(
    providerType: SupportedProvider,
    webhookResult: WebhookResult,
  ) {
    if (providerType !== "MOOTA" || !webhookResult.raw) {
      return;
    }

    const rawData = this.asRecord(webhookResult.raw);
    const mutationId = this.asString(rawData.mutation_id);
    if (!mutationId) {
      return;
    }

    const existing =
      await this.unmatchedMutationRepository.findByTransactionId(mutationId);

    if (existing) {
      return;
    }

    const amount = Number(rawData.amount);
    if (Number.isNaN(amount)) {
      return;
    }

    await this.unmatchedMutationRepository.create({
      provider: "MOOTA",
      transactionId: mutationId,
      amount,
      description:
        this.asString(rawData.description) || "Mutasi masuk dari Moota",
      type: this.asString(rawData.type) || "CR",
      date: this.parseDateOrNow(rawData.date),
      bankId: this.asString(rawData.bank_id),
      rawPayload: JSON.parse(JSON.stringify(rawData)),
      status: "PENDING",
    });
  }

  private async updateInvoicesOnPaymentTx(
    tx: BillingTx,
    paymentId: string,
    notes: string | null,
  ) {
    let invoiceIds = this.extractInvoiceIdsFromNotes(notes);

    if (invoiceIds.length === 0) {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        select: { invoiceId: true },
      });
      if (payment?.invoiceId) {
        invoiceIds = [payment.invoiceId];
      }
    }

    if (invoiceIds.length === 0) {
      return;
    }

    for (const invoiceId of invoiceIds) {
      const invoice =
        await this.invoiceRepository.findUniqueAuthWithPayment(invoiceId);

      if (!invoice) {
        console.warn(`[Webhook] Invoice ${invoiceId} not found`);
        continue;
      }

      const totalPaid = invoice.payment.reduce((sum, payment) => {
        if (!payment.gatewayStatus || payment.gatewayStatus === "PAID") {
          return sum + BigInt(payment.amount);
        }
        return sum;
      }, BigInt(0));

      let invoiceStatus: InvoiceStatus;
      if (totalPaid >= invoice.totalAmount) {
        invoiceStatus = InvoiceStatus.PAID;
      } else if (totalPaid > BigInt(0)) {
        invoiceStatus = InvoiceStatus.PARTIAL_PAID;
      } else {
        invoiceStatus = invoice.status as InvoiceStatus;
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: totalPaid,
          status: invoiceStatus,
          ...(invoiceStatus === "PAID" ? { paidAt: new Date() } : {}),
        },
      });
    }
  }

  private async runPostPaidSideEffects(
    invoiceId: string | null,
    notes: string | null,
  ) {
    const invoiceIds = this.extractInvoiceIdsFromNotes(notes);
    if (invoiceIds.length === 0 && invoiceId) {
      invoiceIds.push(invoiceId);
    }

    for (const invId of invoiceIds) {
      const invoice = await this.invoiceRepository.findUniqueAuth(invId);
      if (invoice?.status !== "PAID") {
        continue;
      }

      await AutomaticBillingService.handleInvoicePaid(invId).catch((err) => {
        console.error(
          `[Webhook] Error triggering side-effects for invoice ${invId}:`,
          err,
        );
      });
    }
  }

  private extractInvoiceIdsFromNotes(notes: string | null): string[] {
    if (!notes) {
      return [];
    }

    try {
      const metadata = JSON.parse(notes);
      if (
        !metadata ||
        typeof metadata !== "object" ||
        !Array.isArray(metadata.invoiceIds)
      ) {
        return [];
      }

      return metadata.invoiceIds.filter(
        (id: unknown): id is string => typeof id === "string" && id.length > 0,
      );
    } catch (error) {
      console.warn("[Webhook] Failed to parse payment notes metadata:", error);
      return [];
    }
  }

  private normalizePaymentMethod(
    paymentMethod: string | undefined,
  ): PaymentMethod | undefined {
    if (!paymentMethod) {
      return undefined;
    }

    const normalized = paymentMethod.trim().toUpperCase().replace(/\s+/g, "_");
    return PAYMENT_METHOD_MAP[normalized] || undefined;
  }

  private hasAmountMismatch(
    storedAmount: bigint,
    webhookAmount: number | undefined,
  ): boolean {
    if (webhookAmount === undefined || Number.isNaN(webhookAmount)) {
      return false;
    }

    return storedAmount !== BigInt(Math.round(webhookAmount));
  }

  private hasTransactionMismatch(
    storedTransactionId: string | null,
    webhookTransactionId: string | undefined,
  ): boolean {
    if (!storedTransactionId || !webhookTransactionId) {
      return false;
    }

    return storedTransactionId !== webhookTransactionId;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0
      ? value
      : undefined;
  }

  private parseDateOrNow(value: unknown): Date {
    return typeof value === "string"
      ? (parseOptionalDate(value) ?? new Date())
      : new Date();
  }
}
