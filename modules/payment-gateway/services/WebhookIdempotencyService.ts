import { logger } from "@/lib/logger";
import { WebhookEventRepository } from "../repositories/WebhookEventRepository";
import type { WebhookEvent } from "../domain/entities/WebhookEvent";
import type { ProviderType } from "../domain/value-objects/ProviderType";
import { v4 as uuidv4 } from "uuid";

export class IdempotencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyError";
  }
}

export class WebhookIdempotencyService {
  constructor(
    private readonly webhookEventRepository = new WebhookEventRepository(),
  ) {}

  /**
   * Generate idempotency key from provider and transaction/order ID
   */
  generateIdempotencyKey(
    provider: ProviderType,
    transactionId?: string | null,
    orderId?: string | null,
  ): string {
    const identifier = transactionId || orderId;
    if (!identifier) {
      throw new IdempotencyError(
        `Cannot generate idempotency key for ${provider}: no transactionId or orderId provided`,
      );
    }
    return `${provider}:${identifier}`;
  }

  /**
   * Check if webhook has already been processed
   * @returns WebhookEvent if already processed, null otherwise
   */
  async checkIdempotency(idempotencyKey: string): Promise<WebhookEvent | null> {
    const existingEvent =
      await this.webhookEventRepository.findByIdempotencyKey(idempotencyKey);

    if (existingEvent && existingEvent.status === "PROCESSED") {
      logger.info(`[Idempotency] Webhook already processed: ${idempotencyKey}`);
      return existingEvent;
    }

    return null;
  }

  /**
   * Record webhook event for idempotency tracking
   */
  async recordWebhookEvent(params: {
    idempotencyKey: string;
    provider: ProviderType;
    payload: Record<string, unknown>;
    signature?: string | null;
    rawBody?: string | null;
    orderId?: string | null;
    transactionId?: string | null;
    tenantId?: string | null;
  }): Promise<WebhookEvent> {
    const event: WebhookEvent = {
      id: uuidv4(),
      idempotencyKey: params.idempotencyKey,
      provider: params.provider,
      payload: params.payload,
      signature: params.signature,
      rawBody: params.rawBody,
      status: "PENDING",
      orderId: params.orderId,
      transactionId: params.transactionId,
      tenantId: params.tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.webhookEventRepository.save(event);
    logger.info(
      `[Idempotency] Recorded webhook event: ${params.idempotencyKey}`,
    );

    return event;
  }

  /**
   * Mark webhook as processed
   */
  async markAsProcessed(eventId: string): Promise<void> {
    await this.webhookEventRepository.markAsProcessed(eventId);
    logger.info(`[Idempotency] Marked webhook as processed: ${eventId}`);
  }

  /**
   * Mark webhook as failed
   */
  async markAsFailed(eventId: string, error: string): Promise<void> {
    await this.webhookEventRepository.markAsFailed(eventId, error);
    logger.error(
      `[Idempotency] Marked webhook as failed: ${eventId} - ${error}`,
    );
  }
}
