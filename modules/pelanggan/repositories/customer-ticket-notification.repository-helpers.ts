import { prisma } from "@/lib/prisma";
import {
  buildUnreadAnnouncementWhere,
  buildUnreadTicketWhere,
} from "../services/customer-notification.helpers";
import type { CustomerNotificationQuery } from "../domain/ports/ICustomerTicketRepository";

/** Get unread ticket and announcement summary for customer portal. */
export async function getCustomerNotificationSummary(
  query: CustomerNotificationQuery,
) {
  const unreadTicketWhere = buildUnreadTicketWhere(query.pelangganId);
  const unreadAnnouncementWhere = buildUnreadAnnouncementWhere(
    query.pelangganId,
    query.now,
  );
  const [
    unreadTicketCount,
    ticketsWithNewReplies,
    unreadAnnouncementCount,
    announcements,
  ] = await Promise.all([
    prisma.supportTickets.count({ where: unreadTicketWhere }),
    findTicketsWithNewReplies(unreadTicketWhere, query.limit),
    prisma.announcement.count({ where: unreadAnnouncementWhere }),
    findUnreadAnnouncements(unreadAnnouncementWhere),
  ]);

  return {
    unreadTicketCount,
    ticketsWithNewReplies,
    unreadAnnouncementCount,
    announcements,
  };
}

function findTicketsWithNewReplies(where: object, limit: number) {
  return prisma.supportTickets.findMany({
    where,
    select: buildTicketReplyNotificationSelect(),
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

function buildTicketReplyNotificationSelect() {
  return {
    id: true,
    ticketNumber: true,
    subject: true,
    status: true,
    replies: {
      where: { isFromAdmin: true },
      orderBy: { createdAt: "desc" as const },
      take: 1,
      select: buildLatestReplySelect(),
    },
  };
}

function buildLatestReplySelect() {
  return {
    id: true,
    message: true,
    createdAt: true,
    user: { select: { name: true } },
  };
}

function findUnreadAnnouncements(where: object) {
  return prisma.announcement.findMany({
    where,
    select: {
      id: true,
      title: true,
      content: true,
      isPinned: true,
      createdAt: true,
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 3,
  });
}
