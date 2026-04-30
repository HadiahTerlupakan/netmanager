import { Prisma } from "@prisma/client";
import { TicketStatus } from "../types/pelanggan.enums";

const DEFAULT_NOTIFICATION_SENDER = "Tim Dukungan";
const MAX_NOTIFICATION_PREVIEW_LENGTH = 100;
const CUSTOMER_ANNOUNCEMENT_TARGETS = ["ALL", "CUSTOMER"] as const;
const ACTIVE_TICKET_STATUSES = [
  TicketStatus.WAITING_CUSTOMER,
  TicketStatus.IN_PROGRESS,
] as const;

export const buildUnreadTicketWhere = (
  customerId: string,
): Prisma.SupportTicketsWhereInput => ({
  pelangganId: customerId,
  status: { in: [...ACTIVE_TICKET_STATUSES] },
  replies: { some: { isFromAdmin: true } },
});

export const buildUnreadAnnouncementWhere = (
  customerId: string,
  now: Date,
): Prisma.AnnouncementWhereInput => ({
  isActive: true,
  target: { in: [...CUSTOMER_ANNOUNCEMENT_TARGETS] },
  AND: [
    { OR: [{ startDate: null }, { startDate: { lte: now } }] },
    { OR: [{ endDate: null }, { endDate: { gte: now } }] },
    { reads: { none: { pelangganId: customerId } } },
  ],
});

const truncatePreview = (message: string) =>
  message.length > MAX_NOTIFICATION_PREVIEW_LENGTH
    ? `${message.substring(0, MAX_NOTIFICATION_PREVIEW_LENGTH)}...`
    : message;

const getTicketReplySuffix = (ticketNumber: string) =>
  ticketNumber.split("-").pop() ?? ticketNumber;

/** Build ticket reply notifications for customer portal. */
export const buildTicketReplyNotifications = (
  tickets: Array<{
    id: string;
    ticketNumber: string;
    subject: string;
    replies: Array<{
      id: string;
      message: string;
      createdAt: Date;
      user: { name: string } | null;
    }>;
  }>,
) =>
  tickets
    .filter((ticket) => ticket.replies.length > 0)
    .map((ticket) => {
      const reply = ticket.replies[0]!;
      return {
        id: `ticket-reply-${reply.id}`,
        type: "TICKET_REPLY",
        title: "Balasan Tiket",
        message: `Tiket #${getTicketReplySuffix(ticket.ticketNumber)} telah dibalas`,
        preview: truncatePreview(reply.message),
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ticketSubject: ticket.subject,
        createdAt: reply.createdAt,
        isRead: false,
        sender: reply.user?.name || DEFAULT_NOTIFICATION_SENDER,
      };
    });
