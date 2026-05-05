import type { WebhookEvent } from "../entities/WebhookEvent";

/** Repository port for webhook event persistence */
export interface IWebhookEventRepository {
  save(event: WebhookEvent): Promise<void>;
  findByIdempotencyKey(key: string): Promise<WebhookEvent | null>;
  markAsProcessed(id: string): Promise<void>;
  markAsFailed(id: string, error: string): Promise<void>;
}
