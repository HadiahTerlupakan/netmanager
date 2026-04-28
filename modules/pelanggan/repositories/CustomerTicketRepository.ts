import { prisma } from "@/lib/prisma";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import {
  Prisma,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";

import type {
  CustomerTicketQuery,
  CustomerTicketUpdateData,
  ICustomerTicketRepository,
} from "../domain/ports/ICustomerTicketRepository";
import { SupportTicketMapper } from "../mappers/SupportTicketMapper";

const ACTIVE_UNREAD_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.WAITING_CUSTOMER,
  TicketStatus.IN_PROGRESS,
];

/**
 * Repository for customer support ticket operations.
 */
export class CustomerTicketRepository implements ICustomerTicketRepository {
  /** Get tickets for a customer with pagination. */
  async findAllForCustomer(
    pelangganId: string,
    options: { page: number; limit: number; status?: string },
  ) {
    const { page, limit, status } = options;
    const skip = (page - 1) * limit;
    const where: Prisma.SupportTicketsWhereInput = {
      pelangganId,
      ...(status && { status: status as TicketStatus }),
    };

    const [tickets, total] = await Promise.all([
      prisma.supportTickets.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
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

  /** Get count of tickets created today for number generation. */
  async getCountForToday(): Promise<number> {
    return prisma.supportTickets.count({
      where: {
        createdAt: {
          gte: toStartOfDay(new Date()),
        },
      },
    });
  }

  /** Count unread ticket notifications that require customer attention. */
  async countUnreadCustomerNotifications(pelangganId: string): Promise<number> {
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

  /** Create a new support ticket. */
  async create(data: {
    pelangganId: string;
    ticketNumber: string;
    category: TicketCategory;
    priority: TicketPriority;
    subject: string;
    description: string;
  }) {
    const ticket = await prisma.supportTickets.create({
      data: {
        id: randomUUID(),
        ticketNumber: data.ticketNumber,
        pelangganId: data.pelangganId,
        category: data.category,
        priority: data.priority,
        subject: data.subject,
        description: data.description,
        updatedAt: new Date(),
      },
      include: {
        pelanggan: {
          select: {
            id: true,
            nama: true,
            idPelanggan: true,
            email: true,
            noTelp: true,
          },
        },
      },
    });

    return SupportTicketMapper.toDomain(ticket);
  }

  /** Map customer ticket list into response DTOs. */
  mapCustomerTicketResponses(
    tickets: Parameters<typeof SupportTicketMapper.toCustomerList>[0],
  ) {
    return SupportTicketMapper.toCustomerList(tickets);
  }

  /** Build customer ticket pagination metadata. */
  buildCustomerTicketPagination(page: number, limit: number, total: number) {
    return buildPaginationMeta({ page, limit, total });
  }

  /** Get admin ticket list. */
  async findAllAdmin(where: CustomerTicketQuery, skip: number, take: number) {
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

  /** Count admin tickets. */
  async countAdmin(where: CustomerTicketQuery) {
    return prisma.supportTickets.count({
      where: where as Prisma.SupportTicketsWhereInput,
    });
  }

  /** Get grouped ticket status counts. */
  async getStatusCounts(where: CustomerTicketQuery) {
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

  /** Get closed tickets with rating replies. */
  async getClosedTicketsWithReplies(where: CustomerTicketQuery) {
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

  /** Get admin ticket detail by id. */
  async findByIdAdmin(id: string) {
    const ticket = await prisma.supportTickets.findUnique({
      where: { id },
      include: {
        pelanggan: {
          select: {
            id: true,
            idPelanggan: true,
            nama: true,
            username: true,
            email: true,
            noTelp: true,
            alamat: true,
            status: true,
            siteId: true,
            hargaPaket: {
              select: { name: true },
            },
          },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        replies: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
      },
    });

    return ticket ? SupportTicketMapper.toDomain(ticket) : null;
  }

  /** Get basic ticket detail by id. */
  async findByIdBasic(id: string) {
    const ticket = await prisma.supportTickets.findUnique({
      where: { id },
      include: {
        pelanggan: { select: { siteId: true, nama: true } },
      },
    });

    return ticket ? SupportTicketMapper.toDomain(ticket) : null;
  }

  /** Update admin ticket. */
  async updateAdmin(id: string, updateData: CustomerTicketUpdateData) {
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

  /** Create reply for ticket. */
  async createReply(data: {
    ticketId: string;
    message: string;
    isFromAdmin: boolean;
    senderId?: string;
    pelangganId?: string;
    attachments?: string[];
  }) {
    return prisma.ticketReplies.create({
      data: {
        id: randomUUID(),
        ticketId: data.ticketId,
        message: data.message,
        isFromAdmin: data.isFromAdmin,
        senderId: data.senderId,
        pelangganId: data.pelangganId,
        attachments: data.attachments ?? undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /** Count active tickets whose latest reply is from customer. */
  async countNeedsReplyAdmin(status: TicketStatus, siteId?: string) {
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

  /** Get customer-owned ticket detail by id. */
  async findByIdForCustomer(id: string, pelangganId: string) {
    const ticket = await prisma.supportTickets.findFirst({
      where: { id, pelangganId },
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, name: true, image: true } } },
        },
        user: { select: { id: true, name: true, image: true } },
        pelanggan: {
          select: {
            id: true,
            idPelanggan: true,
            nama: true,
            email: true,
            noTelp: true,
          },
        },
      },
    });

    return ticket ? SupportTicketMapper.toDomain(ticket) : null;
  }

  /** Update ticket status for customer-owned ticket. */
  async updateCustomerStatus(
    id: string,
    pelangganId: string,
    status: string,
    closedAt?: Date,
  ) {
    const ticket = await prisma.supportTickets.updateMany({
      where: { id, pelangganId },
      data: { status: status as never, ...(closedAt ? { closedAt } : {}) },
    });

    if (ticket.count === 0) {
      return null;
    }

    return this.findByIdForCustomer(id, pelangganId);
  }

  /** Delete ticket by id. */
  async delete(id: string) {
    const ticket = await prisma.supportTickets.delete({ where: { id } });
    return SupportTicketMapper.toDomain(ticket);
  }
}
