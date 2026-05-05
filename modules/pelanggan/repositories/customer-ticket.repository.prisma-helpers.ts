import { prisma } from "@/lib/prisma";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import {
  Prisma,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import type {
  CustomerTicketQuery,
  CustomerTicketUpdateData,
} from "../domain/ports/ICustomerTicketRepository";
import { SupportTicketMapper } from "../mappers/SupportTicketMapper";
import {
  buildCustomerTicketCreateData,
  buildTicketReplyData,
  customerTicketInclude,
  ticketReplyInclude,
} from "./customer-ticket.repository.data-helpers";
import {
  ACTIVE_UNREAD_TICKET_STATUSES,
  buildCustomerTicketWhere,
} from "./customer-ticket.repository.helpers";

export async function findAllTicketsForCustomer(
  pelangganId: string,
  options: { page: number; limit: number; status?: string },
) {
  const { page, limit, status } = options;
  const where = buildCustomerTicketWhere(pelangganId, status);
  const [tickets, total] = await Promise.all([
    prisma.supportTickets.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        replies: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: { replies: true },
        },
      },
    }),
    prisma.supportTickets.count({ where }),
  ]);

  return {
    tickets: SupportTicketMapper.toDomainList(tickets),
    total,
  };
}

export function getTodayTicketCount(): Promise<number> {
  return prisma.supportTickets.count({
    where: {
      createdAt: {
        gte: toStartOfDay(new Date()),
      },
    },
  });
}

export async function countUnreadCustomerTicketNotifications(
  pelangganId: string,
): Promise<number> {
  const tickets = await prisma.supportTickets.findMany({
    where: {
      pelangganId,
      status: { in: ACTIVE_UNREAD_TICKET_STATUSES },
    },
    select: {
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { isFromAdmin: true },
      },
    },
  });

  return tickets.filter((ticket) => ticket.replies[0]?.isFromAdmin).length;
}

export async function createCustomerTicket(data: {
  pelangganId: string;
  ticketNumber: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
}) {
  const ticket = await prisma.supportTickets.create({
    data: buildCustomerTicketCreateData(data),
    include: customerTicketInclude,
  });

  return SupportTicketMapper.toDomain(ticket);
}

export async function findAllAdminTickets(
  where: CustomerTicketQuery,
  skip: number,
  take: number,
) {
  const tickets = await prisma.supportTickets.findMany({
    where: where as Prisma.SupportTicketsWhereInput,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    skip,
    take,
    include: {
      pelanggan: {
        select: {
          id: true,
          idPelanggan: true,
          nama: true,
          noTelp: true,
          email: true,
        },
      },
      user: {
        select: { id: true, name: true },
      },
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          createdAt: true,
          isFromAdmin: true,
          message: true,
        },
      },
      _count: {
        select: { replies: true },
      },
    },
  });

  return SupportTicketMapper.toDomainList(tickets);
}

export function countAdminTickets(where: CustomerTicketQuery) {
  return prisma.supportTickets.count({
    where: where as Prisma.SupportTicketsWhereInput,
  });
}

export async function getAdminTicketStatusCounts(where: CustomerTicketQuery) {
  const counts = await prisma.supportTickets.groupBy({
    by: ["status"],
    where: where as Prisma.SupportTicketsWhereInput,
    _count: {
      status: true,
    },
  });

  return counts.map((count) => ({
    status: count.status,
    _count: { status: count._count.status },
  }));
}

export function findClosedTicketsWithReplies(where: CustomerTicketQuery) {
  return prisma.supportTickets.findMany({
    where: {
      ...(where as Prisma.SupportTicketsWhereInput),
      status: TicketStatus.CLOSED,
    },
    select: {
      replies: {
        where: { isFromAdmin: false, message: { contains: "⭐" } },
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { message: true },
      },
    },
  });
}

export async function updateAdminTicket(
  id: string,
  updateData: CustomerTicketUpdateData,
) {
  const ticket = await prisma.supportTickets.update({
    where: { id },
    data: updateData as Prisma.SupportTicketsUpdateInput,
    include: {
      pelanggan: {
        select: { nama: true, idPelanggan: true },
      },
      user: {
        select: { name: true },
      },
    },
  });

  return SupportTicketMapper.toDomain(ticket);
}

export function createTicketReply(data: {
  ticketId: string;
  message: string;
  isFromAdmin: boolean;
  senderId?: string;
  pelangganId?: string;
  attachments?: string[];
}) {
  return prisma.ticketReplies.create({
    data: buildTicketReplyData(data),
    include: ticketReplyInclude,
  });
}

export async function countAdminTicketsNeedingReply(
  status: TicketStatus,
  siteId?: string,
) {
  const tickets = await prisma.supportTickets.findMany({
    where: {
      status,
      ...(siteId ? { pelanggan: { siteId } } : {}),
    },
    select: {
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { isFromAdmin: true },
      },
    },
  });

  return tickets.filter(
    (ticket) => ticket.replies[0] && !ticket.replies[0].isFromAdmin,
  ).length;
}

export async function updateCustomerOwnedTicketStatus(
  id: string,
  pelangganId: string,
  status: string,
  closedAt?: Date,
) {
  const ticket = await prisma.supportTickets.updateMany({
    where: { id, pelangganId },
    data: {
      status: parseTicketStatus(status),
      ...(closedAt ? { closedAt } : {}),
    },
  });

  return ticket.count;
}

function parseTicketStatus(status: string): TicketStatus {
  if (Object.values(TicketStatus).includes(status as TicketStatus)) {
    return status as TicketStatus;
  }

  throw new Error(`Invalid ticket status: ${status}`);
}

export async function deleteTicket(id: string) {
  const ticket = await prisma.supportTickets.delete({ where: { id } });
  return SupportTicketMapper.toDomain(ticket);
}
