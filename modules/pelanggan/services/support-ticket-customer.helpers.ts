import { logger, logActivitySafe } from "@/lib/logger";
import { socketEmitter } from "@/lib/websocket/emitter";
import { TicketEventDispatcher } from "@/modules/events";

const DEFAULT_CUSTOMER_NAME = "Pengguna";
const REPLY_SUCCESS_MESSAGE = "Balasan berhasil dikirim";
const MIN_RATING = 1;
const MAX_RATING = 5;

/** Log customer ticket creation. */
export function logTicketCreation(
  customerId: string,
  ticket: { id: string; ticketNumber: string; subject: string },
) {
  logActivitySafe({
    action: "CREATE",
    subject: "Support Ticket",
    details: {
      customerId,
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
    },
  });
}

/** Dispatch ticket created event. */
export async function dispatchTicketCreated(
  customerId: string,
  ticket: {
    id: string;
    ticketNumber: string;
    subject: string;
    priority: string;
  },
) {
  await TicketEventDispatcher.onCreated({
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    priority: ticket.priority,
    triggeredBy: customerId,
  }).catch(logTicketCreatedError);
}

/** Build create ticket response payload. */
export function buildCreateTicketResponse(ticket: {
  id: string;
  ticketNumber: string;
  category: string;
  priority: string;
  subject: string;
  status: string;
  createdAt: Date;
}) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    category: ticket.category,
    priority: ticket.priority,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt,
  };
}

/** Emit websocket payload for customer reply. */
export function emitCustomerReply(input: {
  ticketId: string;
  customerId: string;
  ticket: { pelanggan?: { nama: string } | null };
  reply: CustomerReplyRecord;
}) {
  socketEmitter.ticketMessage(input.ticketId, {
    ...buildReplySocketBody(input.reply),
    sender: buildReplySender(input.customerId, input.ticket),
    attachments: (input.reply.attachments as string[] | null) ?? null,
  });
}

/** Build API response for customer reply. */
export function buildReplyResponse(reply: CustomerReplyRecord) {
  return {
    message: REPLY_SUCCESS_MESSAGE,
    reply: {
      id: reply.id,
      message: reply.message,
      createdAt: reply.createdAt,
      isFromAdmin: reply.isFromAdmin,
      attachments: reply.attachments,
    },
  };
}

/** Build ticket closing message from optional rating and feedback. */
export function buildClosingMessage(input: {
  feedback?: string;
  rating?: number;
}) {
  const parts = ["✅ Tiket ditutup oleh pelanggan."];
  const ratingLabel = getRatingLabel(input.rating);
  if (ratingLabel) parts.push(`\n\n📊 Rating: ${ratingLabel}`);
  if (input.feedback?.trim())
    parts.push(`\n\n💬 Feedback:\n${input.feedback.trim()}`);
  return parts.join("");
}

type CustomerReplyRecord = {
  id: string;
  message: string;
  createdAt: Date;
  isFromAdmin: boolean;
  attachments?: unknown;
};

function logTicketCreatedError(error: unknown) {
  logger.error(
    "Failed to publish TICKET_CREATED event",
    error instanceof Error ? error : undefined,
  );
}

function buildReplySocketBody(reply: CustomerReplyRecord) {
  return {
    id: reply.id,
    message: reply.message,
    isFromAdmin: false,
    createdAt: reply.createdAt.toISOString(),
  };
}

function buildReplySender(
  customerId: string,
  ticket: { pelanggan?: { nama: string } | null },
) {
  return {
    id: customerId,
    name: ticket.pelanggan?.nama || DEFAULT_CUSTOMER_NAME,
  };
}

function getRatingLabel(rating?: number) {
  if (!rating || rating < MIN_RATING || rating > MAX_RATING) return "";
  const labels = {
    1: "⭐ Tidak Puas",
    2: "⭐⭐ Kurang Puas",
    3: "⭐⭐⭐ Cukup Puas",
    4: "⭐⭐⭐⭐ Puas",
    5: "⭐⭐⭐⭐⭐ Sangat Puas",
  } as const;
  return labels[rating as keyof typeof labels] || "";
}
