import { logger } from "@/lib/logger";
import type { GatewayPaymentStatus, Prisma } from "@/modules/finance";

import { FinanceRepositoryFacade } from "@/modules/finance";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { PaymentGatewayManager } from "./PaymentGatewayService";
import {
  isUnpaidTerminalStatus,
  releaseCheckoutCoupons,
  restoreReleasedCoupons,
} from "./abandoned-checkout";
import {
  findCheckoutPayments,
  settleCheckoutInvoices,
  sumCheckoutAmount,
} from "./webhook-checkout-settlement";
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
  hasAmountMismatch,
  normalizePaymentMethod,
  hasTransactionMismatch,
} from "./webhook-utils";

type PaymentRepository = ReturnType<
  typeof FinanceRepositoryFacade.createPaymentRepository
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
  private readonly paymentLookupService: WebhookPaymentLookupService;
  private readonly payloadParser: WebhookPayloadParser;
  private readonly verificationService: WebhookVerificationService;
  private readonly idempotencyService: WebhookIdempotencyService;
  private readonly metrics = getPaymentGatewayMetrics();

  constructor(dependencies?: {
    gatewayManager?: PaymentGatewayManager;
    paymentRepository?: PaymentRepository;
    unmatchedMutationRepository?: UnmatchedMutationRepository;
    paymentLookupService?: WebhookPaymentLookupService;
    payloadParser?: WebhookPayloadParser;
    verificationService?: WebhookVerificationService;
    idempotencyService?: WebhookIdempotencyService;
  }) {
    this.gatewayManager =
      dependencies?.gatewayManager ?? new PaymentGatewayManager();
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
    let parsedProvider: string | undefined;

    try {
      // Step 1: Parse payload
      const { provider, payload } = this.payloadParser.parse(
        input.rawBody,
        input.providerType,
      );
      parsedProvider = provider;

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
      // Status ikut di kunci: notifikasi pending lalu settlement untuk
      // transaksi yang sama adalah dua kejadian berbeda.
      const idempotencyKey = this.idempotencyService.generateIdempotencyKey(
        provider,
        webhookResult.transactionId,
        webhookResult.orderId,
        webhookResult.status,
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

      const checkout = payment ? await findCheckoutPayments(payment.id) : [];
      const chargedAmount = sumCheckoutAmount(checkout);

      // Step 8: Validate amount
      if (payment && hasAmountMismatch(chargedAmount, webhookResult.amount)) {
        logger.warn(
          `[Webhook] Amount mismatch for payment ${payment.id}: expected ${chargedAmount}, received ${webhookResult.amount}`,
        );
        await this.idempotencyService.markAsFailed(
          webhookEventId,
          `Amount mismatch: expected ${chargedAmount}, received ${webhookResult.amount}`,
        );
        this.metrics.recordWebhookFailed(provider, "Amount mismatch");
        return {
          status: 200,
          body: {
            status: "ok",
            message: "Payment amount mismatch - flagged for review",
          },
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

      // Step 10: Check if already processed. Invoice tetap dihitung ulang:
      // proses yang mati setelah commit dipulihkan oleh retry gateway.
      if (payment.gatewayStatus === "PAID") {
        await settleCheckoutInvoices(checkout);
        await this.idempotencyService.markAsProcessed(webhookEventId);
        this.metrics.recordWebhookProcessed(provider, Date.now() - startTime);
        return {
          status: 200,
          body: { status: "ok", message: "Already processed" },
        };
      }

      // Step 11: Update semua payment checkout dan tandai event dalam satu tx.
      const outcome = await prismaBillingAuth.$transaction(async (tx) => {
        // Re-check idempotency di dalam tx untuk mencegah race condition
        const currentPayment = await tx.payment.findUnique({
          where: { id: payment.id },
        });

        if (currentPayment?.gatewayStatus === "PAID") {
          return null;
        }

        if (
          hasTransactionMismatch(
            currentPayment?.transactionId ?? null,
            webhookResult.transactionId,
          )
        ) {
          return null;
        }

        // gatewayProvider tetap kode channel dari portal (mis. "SP"), agar
        // admin tahu metode yang dipakai; gateway-nya bisa diturunkan darinya.
        const paymentUpdate: Prisma.PaymentUpdateManyMutationInput = {
          gatewayStatus,
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

        // Webhook ganda yang berbarengan menunggu kunci baris di sini; yang
        // kedua tidak lagi menemukan baris non-PAID dan tidak ikut melunasi.
        const moved = await tx.payment.updateMany({
          where: {
            id: { in: checkout.map((p) => p.id) },
            gatewayStatus: { not: "PAID" },
          },
          data: paymentUpdate,
        });
        if (webhookResult.transactionId) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { transactionId: webhookResult.transactionId },
          });
        }

        if (webhookEventId) {
          await tx.webhookEvent.update({
            where: { id: webhookEventId },
            data: { status: "PROCESSED", processedAt: new Date() },
          });
        }
        return moved.count > 0 ? gatewayStatus : null;
      });

      // Step 12: Lunasi invoice, atau kembalikan kupon checkout yang tidak
      // dibayar, setelah commit. Invoice dan kupon ada di database lain dari
      // transaksi ini, jadi tidak bisa ikut di dalamnya.
      if (outcome === "PAID") {
        await restoreReleasedCoupons(checkout);
        await settleCheckoutInvoices(checkout);
      } else if (outcome && isUnpaidTerminalStatus(outcome)) {
        await releaseCheckoutCoupons(checkout);
      }

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

      if (parsedProvider) {
        this.metrics.recordWebhookFailed(
          parsedProvider,
          error instanceof Error ? error.message : String(error),
        );
      }

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
