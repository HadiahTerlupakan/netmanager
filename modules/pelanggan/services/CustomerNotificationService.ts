import { prisma } from "@/modules/database";
import { Prisma, TicketStatus } from "@prisma/client";

export class CustomerNotificationService {
  async getNotifications(customerId: string, limit: number = 10) {
    const now = new Date();

    const unreadTicketWhere: Prisma.SupportTicketsWhereInput = {
      pelangganId: customerId,
      status: {
        in: [TicketStatus.WAITING_CUSTOMER, TicketStatus.IN_PROGRESS],
      },
      replies: {
        some: {
          isFromAdmin: true,
        },
      },
    };

    const unreadAnnouncementWhere: Prisma.AnnouncementWhereInput = {
      isActive: true,
      target: {
        in: ["ALL", "CUSTOMER"],
      },
      AND: [
        {
          OR: [{ startDate: null }, { startDate: { lte: now } }],
        },
        {
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
        {
          reads: {
            none: {
              pelangganId: customerId,
            },
          },
        },
      ],
    };

    const [
      unreadTicketCount,
      ticketsWithNewReplies,
      unreadAnnouncementCount,
      announcements,
    ] = await Promise.all([
      prisma.supportTickets.count({ where: unreadTicketWhere }),
      prisma.supportTickets.findMany({
        where: unreadTicketWhere,
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          replies: {
            where: {
              isFromAdmin: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              message: true,
              createdAt: true,
              user: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
      prisma.announcement.count({ where: unreadAnnouncementWhere }),
      prisma.announcement.findMany({
        where: unreadAnnouncementWhere,
        select: {
          id: true,
          title: true,
          content: true,
          isPinned: true,
          createdAt: true,
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 3,
      }),
    ]);

    const notifications = ticketsWithNewReplies
      .filter((ticket) => ticket.replies.length > 0)
      .map((ticket) => {
        const reply = ticket.replies[0]!;
        return {
          id: `ticket-reply-${reply.id}`,
          type: "TICKET_REPLY",
          title: "Balasan Tiket",
          message: `Tiket #${ticket.ticketNumber.split("-").pop()} telah dibalas`,
          preview:
            reply.message.substring(0, 100) +
            (reply.message.length > 100 ? "..." : ""),
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          ticketSubject: ticket.subject,
          createdAt: reply.createdAt,
          isRead: false,
          sender: reply.user?.name || "Tim Dukungan",
        };
      });

    return {
      notifications,
      announcements,
      unreadTicketCount,
      unreadAnnouncementCount,
      unreadCount: unreadTicketCount + unreadAnnouncementCount,
    };
  }
}

let customerNotificationServiceInstance: CustomerNotificationService | null =
  null;

export function getCustomerNotificationService(): CustomerNotificationService {
  if (!customerNotificationServiceInstance) {
    customerNotificationServiceInstance = new CustomerNotificationService();
  }

  return customerNotificationServiceInstance;
}
