import { prisma } from "@/lib/prisma";
import { prismaMitra } from "@/lib/prisma-mitra";
import type { TicketStatus, TaskStatus } from "@prisma/client";

export class TicketRepository {
  async createReply(data: {
    id: string;
    ticketId: string;
    message: string;
    isFromAdmin: boolean;
    senderId: string;
  }) {
    return prisma.ticketReplies.create({ data });
  }

  async updateTicketStatus(ticketId: string, status: TicketStatus) {
    return prisma.supportTickets.update({
      where: { id: ticketId },
      data: { status },
    });
  }
}

export class WorkOrderTemplateRepository {
  async findItemsByTemplateId(templateId: string) {
    return prisma.workOrderTemplateItem.findMany({
      where: { templateId },
      orderBy: { order: "asc" },
    });
  }

  async createManyTasks(
    tasks: Array<{
      id: string;
      workOrderId: string;
      title: string;
      description?: string | null;
      order: number;
      status: TaskStatus;
      updatedAt: Date;
      tenantId: string;
    }>,
  ) {
    return prisma.workOrderTasks.createMany({ data: tasks });
  }
}

export class WarrantyCheckRepository {
  async findLastCompletedWoByMitra(pelangganId: string) {
    return prisma.workOrders.findFirst({
      where: {
        pelangganId,
        status: "COMPLETED",
        assignedMitraId: { not: null },
        completedAt: { not: null },
      },
      orderBy: { completedAt: "desc" },
    });
  }

  async findMitraById(mitraId: string) {
    return prismaMitra.mitra.findUnique({
      where: { id: mitraId },
    });
  }
}
