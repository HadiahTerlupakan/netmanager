import { logger } from "@/lib/logger";
import type { GatewayPaymentStatus } from "@/modules/finance";

import { FinanceRepositoryFacade } from "@/modules/finance";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { PaymentGatewayManager } from "./PaymentGatewayService";
import {
  isUnpaidTerminalStatus,
  releaseUnusedCheckoutCoupons,
} from "./abandoned-checkout";
import {
  findCheckoutPayments,
  settleCheckoutPaidAtGateway,
} from "./gateway-status-settlement";
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
import { hasTransactionMismatch } from "./webhook-utils";

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

type WebhookContext = {
  provider: string;
  webhookResult: WebhookResult;
  webhookEventId: string;
  startTime: number;
};

export type ProcessWebhookResult = {
  status: number;
  body: { status?: string; error?: string; message?: string };
};

// Tetap dijawab 200: retry gateway tidak mengubah nominal maupun nomor
// transaksinya.
const MISMATCH_RESPONSES = {
  AMOUNT_MISMATCH: {
    failure: "Amount mismatch",
    message: "Payment amount mismatch - flagged for review",
  },
  TRANSACTION_MISMATCH: {
    failure: "Transaction mismatch",
    message: "Payment transaction mismatch - flagged for review",
  },
} as const;

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

      // Step 8: Handle payment not found
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

      // Step 9: Lunasi lewat jalur yang sama dengan cek status gateway dan
      // penyapu checkout, atau tutup checkout yang tidak dibayar. Event baru
      // ditandai PROCESSED setelah semuanya selesai, jadi proses yang mati di
      // tengahnya diulang oleh retry gateway.
      const context = { provider, webhookResult, webhookEventId, startTime };
      return webhookResult.status === "PAID"
        ? await this.settlePaid(payment.id, context)
        : await this.closeUnpaid(payment, gatewayStatus, context);
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

  private async settlePaid(
    paymentId: string,
    context: WebhookContext,
  ): Promise<ProcessWebhookResult> {
    const settlement = await settleCheckoutPaidAtGateway({
      paymentId,
      provider: context.provider,
      status: context.webhookResult,
    });
    if (
      settlement.outcome === "AMOUNT_MISMATCH" ||
      settlement.outcome === "TRANSACTION_MISMATCH"
    ) {
      const response = MISMATCH_RESPONSES[settlement.outcome];
      return this.rejectMismatch(
        context,
        `${response.failure}: expected ${settlement.expected}, received ${settlement.received}`,
        response.failure,
        response.message,
      );
    }

    await this.idempotencyService.markAsProcessed(context.webhookEventId);
    this.metrics.recordWebhookProcessed(
      context.provider,
      Date.now() - context.startTime,
    );
    return {
      status: 200,
      body:
        settlement.outcome === "ALREADY_PAID"
          ? { status: "ok", message: "Already processed" }
          : { status: "ok" },
    };
  }

  /**
   * Notifikasi tanpa uang (menunggu, kedaluwarsa, batal, gagal). Hanya
   * payment checkout yang masih menunggu yang ditutup, dan kupon hanya
   * dikembalikan untuk payment yang benar-benar ditutup di sini dan tidak
   * dipegang payment lain; payment yang sudah lunas, dikembalikan, atau
   * ditutup lebih dulu tidak berubah. Nomor transaksinya tidak disimpan:
   * percobaan bayar yang ditolak (mis. kartu di Midtrans) bernomor lain dari
   * percobaan yang berhasil untuk orderId yang sama.
   */
  private async closeUnpaid(
    payment: { id: string; transactionId: string | null },
    gatewayStatus: GatewayPaymentStatus,
    context: WebhookContext,
  ): Promise<ProcessWebhookResult> {
    const received = context.webhookResult.transactionId;
    if (hasTransactionMismatch(payment.transactionId, received)) {
      // Tidak ada uang yang dinyatakan masuk, jadi staf tidak diberi tahu.
      const failure = MISMATCH_RESPONSES.TRANSACTION_MISMATCH.failure;
      return this.rejectMismatch(
        context,
        `${failure}: expected ${payment.transactionId}, received ${received}`,
        failure,
        "Payment transaction mismatch - ignored",
      );
    }

    if (isUnpaidTerminalStatus(gatewayStatus)) {
      const checkout = await findCheckoutPayments(payment.id);
      const closed = await prismaBillingAuth.payment.updateManyAndReturn({
        where: {
          id: { in: checkout.map((p) => p.id) },
          gatewayStatus: "PENDING",
        },
        data: { gatewayStatus },
        select: {
          id: true,
          couponUsageId: true,
          couponId: true,
          pelangganId: true,
          tenantId: true,
        },
      });
      await releaseUnusedCheckoutCoupons(closed);
    }

    await this.idempotencyService.markAsProcessed(context.webhookEventId);
    this.metrics.recordWebhookProcessed(
      context.provider,
      Date.now() - context.startTime,
    );
    return { status: 200, body: { status: "ok" } };
  }

  private async rejectMismatch(
    context: WebhookContext,
    reason: string,
    failure: string,
    message: string,
  ): Promise<ProcessWebhookResult> {
    await this.idempotencyService.markAsFailed(context.webhookEventId, reason);
    this.metrics.recordWebhookFailed(context.provider, failure);
    return { status: 200, body: { status: "ok", message } };
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
