import { prisma } from "@/lib/prisma";
import { LeaveStatus, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

export class LeaveRequestRepository {
  /** Create leave request with generated id. */
  async create(
    data: Omit<Prisma.LeaveRequestUncheckedCreateInput, "id" | "updatedAt">,
  ) {
    return prisma.leaveRequest.create({
      data: { ...data, id: randomUUID(), updatedAt: new Date() },
    });
  }

  /** Update leave request by id. */
  async update(id: string, data: Prisma.LeaveRequestUpdateInput) {
    return prisma.leaveRequest.update({ where: { id }, data });
  }

  /** Delete leave request by id. */
  async delete(id: string) {
    return prisma.leaveRequest.delete({ where: { id } });
  }

  /** Find leave request with compact user metadata. */
  async findById(id: string) {
    return prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            departments: { select: { name: true } },
            sites: { select: { name: true } },
          },
        },
      },
    });
  }

  /** Find leave requests with admin filters. */
  async findAll(filters?: {
    userId?: string;
    status?: LeaveStatus;
    startDate?: Date;
    endDate?: Date;
    departmentId?: string;
    siteId?: string;
    skip?: number;
    take?: number;
    tenantId?: string;
  }) {
    return prisma.leaveRequest.findMany({
      where: this.buildFilterWhere(filters),
      include: {
        user: {
          select: {
            name: true,
            image: true,
            departments: { select: { name: true } },
            sites: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      ...(filters?.skip !== undefined ? { skip: filters.skip } : {}),
      ...(filters?.take !== undefined ? { take: filters.take } : {}),
    });
  }

  /** Count leave requests with admin filters. */
  async count(filters?: {
    userId?: string;
    status?: LeaveStatus;
    departmentId?: string;
    siteId?: string;
    tenantId?: string;
  }) {
    return prisma.leaveRequest.count({ where: this.buildFilterWhere(filters) });
  }

  /** Find pending tukar libur requests scheduled within a date range. */
  async findPendingTukarLiburInRange(startDate: Date, endDate: Date) {
    return prisma.leaveRequest.findMany({
      where: {
        type: "TUKAR_LIBUR",
        status: "PENDING",
        startDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        tenantId: true,
      },
    });
  }

  private buildFilterWhere(filters?: {
    userId?: string;
    status?: LeaveStatus;
    startDate?: Date;
    endDate?: Date;
    departmentId?: string;
    siteId?: string;
    tenantId?: string;
  }): Prisma.LeaveRequestWhereInput {
    return {
      tenantId: filters?.tenantId,
      ...(filters?.userId ? { userId: filters.userId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.startDate && filters?.endDate
        ? {
            startDate: { gte: filters.startDate },
            endDate: { lte: filters.endDate },
          }
        : {}),
      ...(filters?.departmentId || filters?.siteId
        ? {
            user: {
              ...(filters.departmentId
                ? { departmentId: filters.departmentId }
                : {}),
              ...(filters.siteId ? { siteId: filters.siteId } : {}),
            },
          }
        : {}),
    };
  }

  /** Find all pending leave requests with reminder tracking fields. */
  async findPendingForReminder() {
    return prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        startDate: true,
        submittedAt: true,
        tenantId: true,
        userId: true,
        type: true,
        firstReminderSentAt: true,
        secondReminderSentAt: true,
        finalReminderSentAt: true,
        user: { select: { name: true } },
      },
    });
  }

  /** Find active users with APPROVE_LEAVE permission in a tenant. */
  async findApproverIds(tenantId: string): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        role: { permission: { some: { name: "APPROVE_LEAVE" } } },
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }
}
