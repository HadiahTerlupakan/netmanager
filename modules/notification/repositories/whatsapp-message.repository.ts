import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  WhatsAppMessage,
  WhatsAppMessageCreateInput,
  WhatsAppMessageUpdateInput,
  WhatsAppMessageStatus,
} from "../domain/whatsapp-message.entity";

export interface MessageListFilter {
  tenantId?: string;
  status?: WhatsAppMessageStatus;
  accountId?: string;
  phone?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface PaginatedMessages {
  items: WhatsAppMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GlobalStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  delivered: number;
  read: number;
}

export class WhatsAppMessageRepository {
  async create(data: WhatsAppMessageCreateInput): Promise<WhatsAppMessage> {
    const result = await prisma.whatsAppMessage.create({
      data: {
        ...data,
        status: data.status ?? "pending",
      },
    });
    return result as WhatsAppMessage;
  }

  async findById(id: string): Promise<WhatsAppMessage | null> {
    const result = await prisma.whatsAppMessage.findUnique({
      where: { id },
      include: {
        account: true,
      },
    });
    return result as WhatsAppMessage | null;
  }

  async findByAccountId(accountId: string): Promise<WhatsAppMessage[]> {
    const results = await prisma.whatsAppMessage.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return results as WhatsAppMessage[];
  }

  async findByStatus(
    status: WhatsAppMessageStatus,
    tenantId?: string,
  ): Promise<WhatsAppMessage[]> {
    const results = await prisma.whatsAppMessage.findMany({
      where: {
        status,
        tenantId: tenantId ?? null,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return results as WhatsAppMessage[];
  }

  async findRecent(
    tenantId?: string,
    limit: number = 50,
  ): Promise<WhatsAppMessage[]> {
    const results = await prisma.whatsAppMessage.findMany({
      where: {
        tenantId: tenantId ?? null,
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return results as WhatsAppMessage[];
  }

  async findFiltered(filter: MessageListFilter): Promise<PaginatedMessages> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(200, Math.max(1, filter.limit ?? 50));

    const where = this.buildFilterWhere(filter);
    const [total, items] = await Promise.all([
      prisma.whatsAppMessage.count({ where }),
      prisma.whatsAppMessage.findMany({
        where,
        include: {
          account: {
            select: { id: true, name: true, phone: true, provider: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: items as WhatsAppMessage[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findDetail(
    id: string,
    tenantId?: string,
  ): Promise<WhatsAppMessage | null> {
    const result = await prisma.whatsAppMessage.findUnique({
      where: { id },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            phone: true,
            provider: true,
            accountType: true,
          },
        },
      },
    });
    if (!result) return null;
    if (tenantId && result.tenantId !== tenantId) return null;
    return result as WhatsAppMessage;
  }

  async getGlobalStats(filter: {
    tenantId?: string;
    accountId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<GlobalStats> {
    const where = this.buildFilterWhere(filter);
    const [total, sent, failed, pending, delivered, read] = await Promise.all([
      prisma.whatsAppMessage.count({ where }),
      prisma.whatsAppMessage.count({ where: { ...where, status: "sent" } }),
      prisma.whatsAppMessage.count({ where: { ...where, status: "failed" } }),
      prisma.whatsAppMessage.count({ where: { ...where, status: "pending" } }),
      prisma.whatsAppMessage.count({
        where: { ...where, status: "delivered" },
      }),
      prisma.whatsAppMessage.count({ where: { ...where, status: "read" } }),
    ]);
    return { total, sent, failed, pending, delivered, read };
  }

  private buildFilterWhere(filter: {
    tenantId?: string;
    status?: WhatsAppMessageStatus;
    accountId?: string;
    phone?: string;
    startDate?: Date;
    endDate?: Date;
  }): Prisma.WhatsAppMessageWhereInput {
    return {
      ...(filter.tenantId ? { tenantId: filter.tenantId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.accountId ? { accountId: filter.accountId } : {}),
      ...(filter.phone
        ? { phone: { contains: filter.phone, mode: "insensitive" } }
        : {}),
      ...(filter.startDate && filter.endDate
        ? { createdAt: { gte: filter.startDate, lte: filter.endDate } }
        : {}),
    };
  }

  async update(
    id: string,
    data: WhatsAppMessageUpdateInput,
  ): Promise<WhatsAppMessage> {
    const result = await prisma.whatsAppMessage.update({
      where: { id },
      data: {
        status: data.status,
        error: data.error,
        messageId: data.messageId,
        response: data.response as Prisma.InputJsonValue,
        sentAt: data.sentAt,
        deliveredAt: data.deliveredAt,
        readAt: data.readAt,
      },
    });
    return result as WhatsAppMessage;
  }

  async updateStatus(
    id: string,
    status: WhatsAppMessageStatus,
    error?: string,
    messageId?: string,
    response?: Record<string, unknown>,
  ): Promise<WhatsAppMessage> {
    const result = await prisma.whatsAppMessage.update({
      where: { id },
      data: {
        status,
        error,
        messageId,
        response: response as Prisma.InputJsonValue,
        sentAt: status === "sent" ? new Date() : undefined,
      },
    });
    return result as WhatsAppMessage;
  }

  /**
   * Update status delivery/read by messageId (Baileys key.id).
   * Status monoton naik: sent < delivered < read. Update hanya kalau status baru
   * lebih tinggi dari existing — cegah downgrade saat event terlambat datang.
   */
  async updateDeliveryStatus(
    messageId: string,
    update: {
      status: "delivered" | "read";
      timestamp?: Date;
    },
  ): Promise<void> {
    const ts = update.timestamp ?? new Date();
    const existing = await prisma.whatsAppMessage.findFirst({
      where: { messageId },
      select: { id: true, status: true, deliveredAt: true },
    });
    if (!existing) return;
    if (!isStatusProgression(existing.status, update.status)) return;

    await prisma.whatsAppMessage.update({
      where: { id: existing.id },
      data: {
        status: update.status,
        deliveredAt:
          update.status === "delivered" || !existing.deliveredAt
            ? ts
            : undefined,
        readAt: update.status === "read" ? ts : undefined,
      },
    });
  }

  async getStats(
    accountId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
  }> {
    const where = {
      accountId,
      ...(startDate && endDate
        ? {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }
        : {}),
    };

    const [total, sent, failed, pending] = await Promise.all([
      prisma.whatsAppMessage.count({ where }),
      prisma.whatsAppMessage.count({ where: { ...where, status: "sent" } }),
      prisma.whatsAppMessage.count({ where: { ...where, status: "failed" } }),
      prisma.whatsAppMessage.count({ where: { ...where, status: "pending" } }),
    ]);

    return { total, sent, failed, pending };
  }

  async deleteOldMessages(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.whatsAppMessage.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        status: {
          in: ["sent", "failed", "delivered", "read"],
        },
      },
    });

    return result.count;
  }
}

const STATUS_RANK: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: -1,
};

function isStatusProgression(
  current: string,
  next: "delivered" | "read",
): boolean {
  return (STATUS_RANK[next] ?? -1) > (STATUS_RANK[current] ?? -1);
}
