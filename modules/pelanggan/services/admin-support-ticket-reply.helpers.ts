import { logger } from "@/lib/logger";
import { socketEmitter } from "@/lib/websocket/emitter";
import { WhatsAppService } from "@/modules/notification";
import type { TicketStatus } from "@prisma/client";

interface AdminTicketReplyInput {
  ticketId: string;
  senderId: string;
  message?: string;
  updateStatus?: TicketStatus;
  sendWhatsApp?: boolean;
  attachments?: string[];
}

/** Emit event websocket untuk balasan tiket baru. */
export function emitReplyEvent(ticketId: string, reply: unknown) {
  const replyPayload = buildReplyPayload(reply);
  socketEmitter.ticketMessage(ticketId, {
    id: replyPayload.id,
    message: replyPayload.message,
    isFromAdmin: true,
    createdAt: replyPayload.createdAt.toISOString(),
    sender: replyPayload.sender,
    attachments: replyPayload.attachments,
  });
}

/** Kirim notifikasi WhatsApp ke pelanggan bila diaktifkan. */
export async function sendReplyWhatsapp(
  ticket: unknown,
  input: AdminTicketReplyInput,
) {
  const safeTicket = ticket as WhatsappTicketRecord;
  if (!canSendWhatsapp(input, safeTicket)) return false;

  try {
    const whatsappService = new WhatsAppService();
    const result = await whatsappService.sendMessage({
      phone: safeTicket.pelanggan.noTelp,
      message: buildWhatsappMessage(safeTicket, input.message?.trim() || ""),
    });
    return result.success;
  } catch (error) {
    logger.error("[Admin Reply] WhatsApp error:", error);
    return false;
  }
}

/** Bentuk payload reply yang kompatibel dengan response lama. */
export function buildReplyPayload(reply: unknown) {
  const safeReply = reply as ReplyRecord;
  return {
    id: safeReply.id,
    message: safeReply.message,
    createdAt: safeReply.createdAt,
    isFromAdmin: safeReply.isFromAdmin,
    sender: safeReply.user ?? null,
    attachments: safeReply.attachments ?? null,
  };
}

function canSendWhatsapp(
  input: AdminTicketReplyInput,
  ticket: WhatsappTicketRecord,
) {
  return Boolean(
    input.sendWhatsApp && ticket.pelanggan?.noTelp && input.message?.trim(),
  );
}

function buildWhatsappMessage(ticket: WhatsappTicketRecord, message: string) {
  const previewMessage = formatMessagePreview(message);
  return `🎫 *Tiket Dukungan*\n\nHalo ${ticket.pelanggan.nama},\n\nTiket Anda *#${ticket.ticketNumber}* telah dibalas oleh tim kami:\n\n"${previewMessage}"\n\nSilakan login ke portal pelanggan untuk melihat detail dan membalas.\n\nTerima kasih,\nTim Dukungan`;
}

function formatMessagePreview(message: string) {
  return message.length > 500 ? `${message.substring(0, 500)}...` : message;
}

type WhatsappTicketRecord = {
  ticketNumber: string;
  pelanggan: { nama: string; noTelp: string };
};

type ReplyRecord = {
  id: string;
  message: string;
  createdAt: Date;
  isFromAdmin: boolean;
  user?: { id: string; name: string | null } | null;
  attachments?: string[] | null;
};
