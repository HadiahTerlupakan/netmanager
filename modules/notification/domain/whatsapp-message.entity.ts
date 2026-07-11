// Domain Entity: WhatsAppMessage
export interface WhatsAppMessage {
  id: string;
  accountId?: string | null;
  phone: string;
  message?: string | null;
  fileUrl?: string | null;
  status: WhatsAppMessageStatus;
  error?: string | null;
  messageId?: string | null;
  response?: Record<string, unknown> | null;
  createdAt: Date;
  sentAt?: Date | null;
  tenantId?: string | null;
}

export type WhatsAppMessageStatus = "pending" | "sent" | "failed";

export interface WhatsAppMessageCreateInput {
  accountId: string;
  phone: string;
  message?: string;
  fileUrl?: string;
  status?: WhatsAppMessageStatus;
  tenantId?: string;
}

export interface WhatsAppMessageUpdateInput {
  status?: WhatsAppMessageStatus;
  error?: string;
  messageId?: string;
  response?: Record<string, unknown>;
  sentAt?: Date;
}
