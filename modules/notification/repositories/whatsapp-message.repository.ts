import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  WhatsAppMessage,
  WhatsAppMessageCreateInput,
  WhatsAppMessageUpdateInput,
  WhatsAppMessageStatus,
} from "../domain/whatsapp-message.entity";

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
          in: ["sent", "failed"],
        },
      },
    });

    return result.count;
  }
}
