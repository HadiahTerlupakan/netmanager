import { randomUUID } from "crypto";
import { TicketCategory, TicketPriority } from "@prisma/client";

export const customerTicketInclude = {
  pelanggan: {
    select: {
      id: true,
      nama: true,
      idPelanggan: true,
      email: true,
      noTelp: true,
    },
  },
} as const;

export const ticketReplyInclude = {
  user: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

export function buildCustomerTicketCreateData(data: {
  pelangganId: string;
  ticketNumber: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
}) {
  return {
    id: randomUUID(),
    ticketNumber: data.ticketNumber,
    pelangganId: data.pelangganId,
    category: data.category,
    priority: data.priority,
    subject: data.subject,
    description: data.description,
    updatedAt: new Date(),
  };
}

export function buildTicketReplyData(data: {
  ticketId: string;
  message: string;
  isFromAdmin: boolean;
  senderId?: string;
  pelangganId?: string;
  attachments?: string[];
}) {
  return {
    id: randomUUID(),
    ticketId: data.ticketId,
    message: data.message,
    isFromAdmin: data.isFromAdmin,
    senderId: data.senderId,
    pelangganId: data.pelangganId,
    attachments: data.attachments ?? undefined,
  };
}
