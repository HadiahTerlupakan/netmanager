import type { ProviderType } from "../value-objects/ProviderType";

export const WebhookEventStatus = {
  PENDING: "PENDING",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
} as const;

export type WebhookEventStatus =
  (typeof WebhookEventStatus)[keyof typeof WebhookEventStatus];

/** Pure domain entity for webhook event audit trail */
export interface WebhookEvent {
  id: string;
  idempotencyKey: string;
  provider: ProviderType;
  payload: Record<string, unknown>;
  signature?: string | null;
  rawBody?: string | null;
  status: WebhookEventStatus;
  orderId?: string | null;
  transactionId?: string | null;
  processedAt?: Date | null;
  error?: string | null;
  tenantId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
