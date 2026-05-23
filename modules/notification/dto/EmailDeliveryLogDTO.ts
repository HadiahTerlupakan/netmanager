import type { EmailDeliveryLog } from "@prisma/client";

export type EmailLogStatus = "PENDING" | "SENT" | "FAILED" | "BOUNCED";

export interface EmailDeliveryLogDTO {
  id: string;
  to: string;
  subject: string;
  status: EmailLogStatus;
  provider: string;
  messageId: string | null;
  errorCategory: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  tenantId: string | null;
}

/** Mask alamat email untuk listing yang dilihat lintas-tenant (super admin). */
export function maskEmailAddress(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "***";

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

/**
 * Parse field error yang disimpan dengan format `[CATEGORY] message`.
 * Field lama tanpa prefix di-treat sebagai message tanpa category.
 */
function parseStoredError(raw: string | null): {
  category: string | null;
  message: string | null;
} {
  if (!raw) return { category: null, message: null };
  const match = raw.match(/^\[([A-Z_]+)\]\s*(.*)$/);
  if (!match) return { category: null, message: raw };
  return { category: match[1], message: match[2] || null };
}

export function toEmailDeliveryLogDTO(
  entity: EmailDeliveryLog,
  options: { maskRecipient: boolean },
): EmailDeliveryLogDTO {
  const { category, message } = parseStoredError(entity.error);
  return {
    id: entity.id,
    to: options.maskRecipient ? maskEmailAddress(entity.to) : entity.to,
    subject: entity.subject,
    status: entity.status as EmailLogStatus,
    provider: entity.provider,
    messageId: entity.messageId,
    errorCategory: category,
    errorMessage: message,
    sentAt: entity.sentAt?.toISOString() ?? null,
    createdAt: entity.createdAt.toISOString(),
    tenantId: entity.tenantId,
  };
}
