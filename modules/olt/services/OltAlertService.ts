import { prisma } from "@/modules/database";
import { logger } from "@/lib/logger";

interface CreateAlertInput {
  tenantId: string;
  oltId: string;
  onuId?: string;
  type: "LOS" | "LOW_POWER" | "OFFLINE" | "CRITICAL_POWER";
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
}

export class OltAlertService {
  async createAlert(input: CreateAlertInput): Promise<void> {
    await prisma.oltAlert.create({
      data: {
        tenantId: input.tenantId,
        oltId: input.oltId,
        onuId: input.onuId ?? null,
        type: input.type,
        message: input.message,
        severity: input.severity,
      },
    });
    logger.warn(`[OltAlert] ${input.severity}: ${input.message}`);
  }

  async getAlerts(
    tenantId: string,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false,
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (unreadOnly) where.isRead = false;

    const [data, total] = await Promise.all([
      prisma.oltAlert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          olt: { select: { name: true } },
          onu: { select: { serialNumber: true } },
        },
      }),
      prisma.oltAlert.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markRead(id: string): Promise<void> {
    await prisma.oltAlert.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(tenantId: string): Promise<void> {
    await prisma.oltAlert.updateMany({
      where: { tenantId, isRead: false },
      data: { isRead: true },
    });
  }
}
