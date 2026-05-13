import { logger } from "@/lib/logger";
import type { GatewayPaymentStatus, Prisma } from "@/modules/finance";

import { FinanceRepositoryFacade } from "@/modules/finance";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { saveToOutboxTx } from "@/lib/event-bus/outbox";
import { EVENT_NAMES, JOB_PRIORITIES } from "@/lib/event-bus";
import { PaymentGatewayManager } from "./PaymentGatewayService";
import { WebhookInvoiceSettlementService } from "./webhook-invoice-settlement-service";
import { WebhookPaymentLookupService } from "./webhook-payment-lookup-service";
import {
  WebhookPayloadParser,
  WebhookPayloadParseError,
} from "./WebhookPayloadParser";
import {
  WebhookVerificationService,
  WebhookVerificationError,
} from "./WebhookVerificationService";
import { WebhookIdempotencyService } from "./WebhookIdempotencyService";
import { getPaymentGatewayMetrics } from "./PaymentGatewayMetrics";
import type { WebhookResult } from "./provider-interface";
import {
  extractInvoiceIdsFromNotes,
  hasAmountMismatch,
  normalizePaymentMethod,
  hasTransactionMismatch,
} from "./webhook-utils";

type PaymentRepository = ReturnType<
  typeof FinanceRepositoryFacade.createPaymentRepository
>;
type InvoiceRepository = ReturnType<
  typeof FinanceRepositoryFacade.createInvoiceRepository
>;
type UnmatchedMutationRepository = ReturnType<
  typeof FinanceRepositoryFacade.createUnmatchedMutationRepository
>;

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
  private readonly payloadParser: WebhookPayloadParser;
  private readonly verificationService: WebhookVerificationService;
  private readonly idempotencyService: WebhookIdempotencyService;
  private readonly metrics = getPaymentGatewayMetrics();

  constructor(dependencies?: {
    gatewayManager?: PaymentGatewayManager;
    paymentRepository?: PaymentRepository;
    invoiceRepository?: InvoiceRepository;
    unmatchedMutationRepository?: UnmatchedMutationRepository;
    invoiceSettlementService?: WebhookInvoiceSettlementService;
    paymentLookupService?: WebhookPaymentLookupService;
    payloadParser?: WebhookPayloadParser;
    verificationService?: WebhookVerificationService;
    idempotencyService?: WebhookIdempotencyService;
  }) {
    this.gatewayManager =
      dependencies?.gatewayManager ?? new PaymentGatewayManager();
    this.invoiceRepository =
      dependencies?.invoiceRepository ??
      FinanceRepositoryFacade.createInvoiceRepository();
    this.invoiceSettlementService =
      dependencies?.invoiceSettlementService ??
      new WebhookInvoiceSettlementService(this.invoiceRepository);
    this.paymentLookupService =
      dependencies?.paymentLookupService ??
      new WebhookPaymentLookupService(
        dependencies?.paymentRepository ??
          FinanceRepositoryFacade.createPaymentRepository(),
        dependencies?.unmatchedMutationRepository ??
          FinanceRepositoryFacade.createUnmatchedMutationRepository(),
      );
    this.payloadParser =
      dependencies?.payloadParser ?? new WebhookPayloadParser();
    this.verificationService =
      dependencies?.verificationService ?? new WebhookVerificationService();
    this.idempotencyService =
      dependencies?.idempotencyService ?? new WebhookIdempotencyService();
  }

  /** Memproses webhook payment gateway dan merekonsiliasi status pembayaran. */
  async process(input: ProcessWebhookInput): Promise<ProcessWebhookResult> {
    const startTime = Date.now();
    let webhookEventId: string | undefined;

    try {
      // Step 1: Parse payload
      const { provider, payload } = this.payloadParser.parse(
        input.rawBody,
        input.providerType,
      );

      this.metrics.recordWebhookReceived(provider);

      // Step 2: Extract and verify signature
      const signature = this.verificationService.extractSignature(
        provider,
        input.headers,
      );

      try {
        this.verificationService.verifySignature(provider, signature);
      } catch (error) {
        if (error instanceof WebhookVerificationError) {
          this.metrics.recordWebhookFailed(provider, "Invalid signature");
          return {
            status: 401,
            body: { error: "Missing required signature" },
          };
        }
        throw error;
      }

      // Step 3: Find payment (early lookup)
      let payment = await this.paymentLookupService.findPaymentByEarlyOrderId({
        providerType: provider,
        payload,
        tenantId: input.tenantId,
      });

      // Step 4: Process webhook with gateway manager
      const webhookResult = await this.gatewayManager.processWebhook(
        provider,
        payload,
        signature,
        input.rawBody,
        payment?.tenantId || undefined,
      );

      const gatewayStatus =
        GATEWAY_STATUS_MAP[webhookResult.status] ?? "FAILED";

      // Step 5: Check idempotency
      const idempotencyKey = this.idempotencyService.generateIdempotencyKey(
        provider,
        webhookResult.transactionId,
        webhookResult.orderId,
      );

      const existingEvent =
        await this.idempotencyService.checkIdempotency(idempotencyKey);
      if (existingEvent) {
        logger.info(`[Webhook] Duplicate webhook detected: ${idempotencyKey}`);
        this.metrics.recordWebhookProcessed(provider, Date.now() - startTime);
        return {
          status: 200,
          body: { status: "ok", message: "Already processed" },
        };
      }

      // Step 6: Record webhook event
      const webhookEvent = await this.idempotencyService.recordWebhookEvent({
        idempotencyKey,
        provider,
        payload,
        signature,
        rawBody: input.rawBody,
        orderId: webhookResult.orderId,
        transactionId: webhookResult.transactionId,
        tenantId: input.tenantId,
      });
      webhookEventId = webhookEvent.id;

      // Step 7: Find payment (late lookup if not found earlier)
      if (!payment) {
        payment = await this.paymentLookupService.findPaymentAfterWebhook({
          providerType: provider,
          webhookResult,
          tenantId: input.tenantId,
        });
      }

      // Step 8: Validate amount
      if (payment && hasAmountMismatch(payment.amount, webhookResult.amount)) {
        logger.warn(
          `[Webhook] Amount mismatch for payment ${payment.id}: expected ${payment.amount}, received ${webhookResult.amount}`,
        );
        await this.idempotencyService.markAsProcessed(webhookEventId);
        this.metrics.recordWebhookProcessed(provider, Date.now() - startTime);
        return {
          status: 200,
          body: { status: "ok", message: "Payment amount mismatch" },
        };
      }

      // Step 9: Handle payment not found
      if (!payment) {
        await this.paymentLookupService.recordUnmatchedMutationForMoota(
          provider,
          webhookResult,
        );
        logger.warn(
          `[Webhook] Payment not found for ${provider === "MOOTA" ? `amount: ${webhookResult.amount}` : `orderId: ${webhookResult.orderId}`}`,
        );
        await this.idempotencyService.markAsProcessed(webhookEventId);
        this.metrics.recordWebhookProcessed(provider, Date.now() - startTime);
        return {
          status: 200,
          body: { status: "ok", message: "Payment record not found" },
        };
      }

      // Step 10: Check if already processed
      if (payment.gatewayStatus === "PAID") {
        await this.idempotencyService.markAsProcessed(webhookEventId);
        this.metrics.recordWebhookProcessed(provider, Date.now() - startTime);
        return {
          status: 200,
          body: { status: "ok", message: "Already processed" },
        };
      }

      // Step 11 & 12: Update payment + invoice + emit outbox secara atomik dalam satu tx.
      // Ini memastikan: kalau tx commit → event PASTI masuk outbox → processor dispatch
      // dengan retry. Kalau tx rollback → outbox insert juga rollback (durability Phase 4).
      await prismaBillingAuth.$transaction(async (tx) => {
        // Re-check idempotency di dalam tx untuk mencegah race condition
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

        // Update payment status
        const paymentUpdate: Prisma.PaymentUpdateInput = {
          gatewayStatus,
          transactionId:
            webhookResult.transactionId ||
            currentPayment?.transactionId ||
            null,
          gatewayProvider: provider,
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

        if (gatewayStatus !== "PAID") {
          return;
        }

        // Update invoice status dalam tx yang sama
        await this.invoiceSettlementService.updateInvoicesOnPaymentTx(
          tx,
          payment.id,
          payment.notes,
        );

        // Emit INVOICE_PAID ke outbox secara atomik dalam tx yang sama.
        // Kalau tx commit → event PASTI masuk outbox → processor dispatch dengan retry.
        // Kalau tx rollback → outbox insert juga rollback.
        const invoiceIds = extractInvoiceIdsFromNotes(payment.notes);
        const targetIds =
          invoiceIds.length > 0
            ? invoiceIds
            : payment.invoiceId
              ? [payment.invoiceId]
              : [];

        for (const invId of targetIds) {
          const invoice = await tx.invoice.findUnique({
            where: { id: invId },
            select: {
              id: true,
              pelangganId: true,
              totalAmount: true,
              status: true,
              tenantId: true,
            },
          });
          if (invoice?.status !== "PAID") continue;

          await saveToOutboxTx(tx, {
            eventName: EVENT_NAMES.INVOICE_PAID,
            payload: {
              invoiceId: invoice.id,
              pelangganId: invoice.pelangganId,
              amount: Number(invoice.totalAmount),
              paidAt: (webhookResult.paidAt ?? new Date()).toISOString(),
              paymentMethod: webhookResult.paymentMethod,
              tenantId: invoice.tenantId ?? undefined,
            },
            priority: JOB_PRIORITIES.CRITICAL,
            category: "billing",
            aggregateId: invoice.id,
            aggregateType: "Invoice",
          });
        }
      });

      await this.idempotencyService.markAsProcessed(webhookEventId);
      this.metrics.recordWebhookProcessed(provider, Date.now() - startTime);

      return {
        status: 200,
        body: { status: "ok" },
      };
    } catch (error) {
      if (webhookEventId) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        await this.idempotencyService.markAsFailed(
          webhookEventId,
          errorMessage,
        );
      }

      const { provider } = this.payloadParser.parse(
        input.rawBody,
        input.providerType,
      );
      this.metrics.recordWebhookFailed(
        provider,
        error instanceof Error ? error.message : String(error),
      );

      return this.handleError(error);
    }
  }

  private handleError(error: unknown): ProcessWebhookResult {
    if (error instanceof WebhookPayloadParseError) {
      return {
        status: 400,
        body: { error: error.message },
      };
    }

    if (error instanceof WebhookVerificationError) {
      return {
        status: 401,
        body: { status: "error", message: "Invalid signature" },
      };
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`[Webhook] Error processing webhook:`, err.message, err.stack);

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
