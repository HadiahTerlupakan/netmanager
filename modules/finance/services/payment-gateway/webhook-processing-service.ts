import { logger } from "@/lib/logger";
import type {
  GatewayPaymentStatus,
  Prisma,
} from "../../lib/billing-prisma-boundary";

import { prismaBillingAuth } from "@/lib/prisma-billing";
import { InvoiceRepository } from "../../repositories/InvoiceRepository";
import { PaymentRepository } from "../../repositories/PaymentRepository";
import { UnmatchedMutationRepository } from "../../repositories/UnmatchedMutationRepository";
import { PaymentGatewayManager } from "./gateway-manager";
import { WebhookInvoiceSettlementService } from "./webhook-invoice-settlement-service";
import { WebhookPaymentLookupService } from "./webhook-payment-lookup-service";
import type { WebhookResult } from "./provider-interface";
import {
  hasAmountMismatch,
  hasTransactionMismatch,
  normalizePaymentMethod,
  parseWebhookPayload,
} from "./webhook-utils";

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

export class WebhookProcessingService {
  private readonly gatewayManager: PaymentGatewayManager;
  private readonly invoiceRepository: InvoiceRepository;
  private readonly invoiceSettlementService: WebhookInvoiceSettlementService;
  private readonly paymentLookupService: WebhookPaymentLookupService;

  constructor(dependencies?: {
    gatewayManager?: PaymentGatewayManager;
    paymentRepository?: PaymentRepository;
    invoiceRepository?: InvoiceRepository;
    unmatchedMutationRepository?: UnmatchedMutationRepository;
    invoiceSettlementService?: WebhookInvoiceSettlementService;
    paymentLookupService?: WebhookPaymentLookupService;
  }) {
    this.gatewayManager =
      dependencies?.gatewayManager ?? new PaymentGatewayManager();
    this.invoiceRepository =
      dependencies?.invoiceRepository ?? new InvoiceRepository();
    this.invoiceSettlementService =
      dependencies?.invoiceSettlementService ??
      new WebhookInvoiceSettlementService(this.invoiceRepository);
    this.paymentLookupService =
      dependencies?.paymentLookupService ??
      new WebhookPaymentLookupService(
        dependencies?.paymentRepository,
        dependencies?.unmatchedMutationRepository,
      );
  }

  /** Memproses webhook payment gateway dan merekonsiliasi status pembayaran. */
  async process(input: ProcessWebhookInput): Promise<ProcessWebhookResult> {
    const providerType = input.providerType.toUpperCase();

    if (!this.isSupportedProvider(providerType)) {
      logger.warn(`[Webhook] Unknown provider: ${providerType}`);
      return {
        status: 400,
        body: { error: "Unknown payment provider" },
      };
    }

    const payload = parseWebhookPayload(input.rawBody, providerType);
    if (!payload) {
      return {
        status: 400,
        body: { error: "Invalid request body" },
      };
    }

    try {
      const signature = this.extractSignature(providerType, input.headers);
      let payment = await this.paymentLookupService.findPaymentByEarlyOrderId({
        providerType,
        payload,
        tenantId: input.tenantId,
      });

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
        payment = await this.paymentLookupService.findPaymentAfterWebhook({
          providerType,
          webhookResult,
          tenantId: input.tenantId,
        });
      }

      if (payment && hasAmountMismatch(payment.amount, webhookResult.amount)) {
        logger.warn(
          `[Webhook] Amount mismatch for payment ${payment.id}: expected ${payment.amount}, received ${webhookResult.amount}`,
        );
        return {
          status: 200,
          body: { status: "ok", message: "Payment amount mismatch" },
        };
      }

      if (!payment) {
        await this.paymentLookupService.recordUnmatchedMutationForMoota(
          providerType,
          webhookResult,
        );
        logger.warn(
          `[Webhook] Payment not found for ${providerType === "MOOTA" ? `amount: ${webhookResult.amount}` : `orderId: ${webhookResult.orderId}`}`,
        );
        return {
          status: 200,
          body: { status: "ok", message: "Payment record not found" },
        };
      }

      if (
        hasTransactionMismatch(
          payment.transactionId,
          webhookResult.transactionId,
        )
      ) {
        logger.warn(
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
          hasTransactionMismatch(
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

        const normalizedPaymentMethod = normalizePaymentMethod(
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
          await this.invoiceSettlementService.updateInvoicesOnPaymentTx(
            tx,
            payment.id,
            payment.notes,
          );
        }
      });

      if (gatewayStatus === "PAID") {
        await this.invoiceSettlementService.runPostPaidSideEffects(
          payment.invoiceId,
          payment.notes,
        );
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
      logger.error(
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
}
