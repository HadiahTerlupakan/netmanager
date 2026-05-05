import { prismaBillingAuth } from "@/lib/prisma-billing";
import type { IWebhookEventRepository } from "../domain/ports/IWebhookEventRepository";
import type {
  WebhookEvent,
  WebhookEventStatus,
} from "../domain/entities/WebhookEvent";
import type { ProviderType } from "../domain/value-objects/ProviderType";

export class WebhookEventRepository implements IWebhookEventRepository {
  async save(event: WebhookEvent): Promise<void> {
    await prismaBillingAuth.webhookEvent.create({
      data: {
        id: event.id,
        idempotencyKey: event.idempotencyKey,
        provider: event.provider,
        payload: event.payload as never,
        signature: event.signature,
        rawBody: event.rawBody,
        status: event.status,
        orderId: event.orderId,
        transactionId: event.transactionId,
        processedAt: event.processedAt,
        error: event.error,
        tenantId: event.tenantId,
      },
    });
  }

  async findByIdempotencyKey(key: string): Promise<WebhookEvent | null> {
    const event = await prismaBillingAuth.webhookEvent.findUnique({
      where: { idempotencyKey: key },
    });

    return event ? this.toDomain(event) : null;
  }

  async markAsProcessed(id: string): Promise<void> {
    await prismaBillingAuth.webhookEvent.update({
      where: { id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });
  }

  async markAsFailed(id: string, error: string): Promise<void> {
    await prismaBillingAuth.webhookEvent.update({
      where: { id },
      data: {
        status: "FAILED",
        error,
      },
    });
  }

  private toDomain(prismaEvent: {
    id: string;
    idempotencyKey: string;
    provider: string;
    payload: unknown;
    signature: string | null;
    rawBody: string | null;
    status: string;
    orderId: string | null;
    transactionId: string | null;
    processedAt: Date | null;
    error: string | null;
    tenantId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): WebhookEvent {
    return {
      id: prismaEvent.id,
      idempotencyKey: prismaEvent.idempotencyKey,
      provider: prismaEvent.provider as ProviderType,
      payload: prismaEvent.payload as Record<string, unknown>,
      signature: prismaEvent.signature,
      rawBody: prismaEvent.rawBody,
      status: prismaEvent.status as WebhookEventStatus,
      orderId: prismaEvent.orderId,
      transactionId: prismaEvent.transactionId,
      processedAt: prismaEvent.processedAt,
      error: prismaEvent.error,
      tenantId: prismaEvent.tenantId,
      createdAt: prismaEvent.createdAt,
      updatedAt: prismaEvent.updatedAt,
    };
  }
}
