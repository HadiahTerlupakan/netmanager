import { prisma } from "@/lib/prisma";
import { LeaveStatus, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { SYSTEM_AUTO_APPROVER } from "../domain/leave-approver";

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
    siteIds?: readonly string[];
    skip?: number;
    take?: number;
    tenantId?: string;
  }) {
    const leaves = await prisma.leaveRequest.findMany({
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
    return this.attachApproverNames(leaves, filters?.tenantId);
  }

  /**
   * Tambahkan `approverName`: nama user yang tersimpan di `approvedBy`.
   * `approvedBy` bukan relasi (bisa berisi SYSTEM_AUTO), jadi namanya dibaca
   * terpisah dalam satu query.
   */
  private async attachApproverNames<T extends { approvedBy: string | null }>(
    leaves: T[],
    tenantId?: string,
  ): Promise<Array<T & { approverName: string | null }>> {
    const approverIds = [
      ...new Set(
        leaves
          .map((leave) => leave.approvedBy)
          .filter(
            (id): id is string => id !== null && id !== SYSTEM_AUTO_APPROVER,
          ),
      ),
    ];
    const approvers = approverIds.length
      ? await prisma.user.findMany({
          where: { id: { in: approverIds }, ...(tenantId ? { tenantId } : {}) },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(approvers.map((user) => [user.id, user.name]));
    return leaves.map((leave) => ({
      ...leave,
      approverName: leave.approvedBy
        ? (nameById.get(leave.approvedBy) ?? null)
        : null,
    }));
  }

  /** Count leave requests with admin filters. */
  async count(filters?: {
    userId?: string;
    status?: LeaveStatus;
    departmentId?: string;
    siteIds?: readonly string[];
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
    siteIds?: readonly string[];
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
      ...(filters?.departmentId || filters?.siteIds
        ? {
            user: {
              ...(filters.departmentId
                ? { departmentId: filters.departmentId }
                : {}),
              ...(filters.siteIds
                ? { siteId: { in: [...filters.siteIds] } }
                : {}),
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
