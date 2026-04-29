import { prisma } from "@/lib/prisma";
import {
  toActiveLeaveEntity,
  toTukarLiburDateEntity,
} from "../mappers/AttendanceDomainMapper";

export class LeaveLookupRepository {
  /** Get approved leave stats grouped by user. */
  async getUserLeaveStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    return prisma.leaveRequest.groupBy({
      by: ["userId"],
      where: {
        status: "APPROVED",
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        tenantId,
        ...(siteId || departmentId
          ? {
              user: {
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId }),
              },
            }
          : {}),
      },
      _count: { _all: true },
    });
  }

  /** Find active approved leave for a user on date range. */
  async findActiveLeaveForUserOnDate(
    userId: string,
    startOfDay: Date,
    endOfDay: Date,
    tenantId?: string,
  ) {
    const leave = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        ...(tenantId && { tenantId }),
        status: "APPROVED",
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
      },
      select: { type: true, reason: true },
    });
    return leave ? toActiveLeaveEntity(leave) : null;
  }

  /** Find approved Tukar Libur for source/replacement date. */
  async findApprovedTukarLiburForUserOnDate(
    userId: string,
    startOfDay: Date,
    endOfDay: Date,
    tenantId?: string,
  ) {
    const tukarLibur = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        ...(tenantId && { tenantId }),
        type: "TUKAR_LIBUR",
        status: "APPROVED",
        OR: [
          { startDate: { gte: startOfDay, lte: endOfDay } },
          { replacementDate: { gte: startOfDay, lte: endOfDay } },
        ],
      },
      select: { startDate: true, replacementDate: true },
    });
    return tukarLibur ? toTukarLiburDateEntity(tukarLibur) : null;
  }

  /** Find approved leave for auto-alpha date range. */
  async findApprovedLeaveForUserOnDateRange(
    userId: string,
    tenantId: string,
    startOfDay: Date,
    endOfDay: Date,
  ) {
    return prisma.leaveRequest.findFirst({
      where: {
        userId,
        tenantId,
        status: "APPROVED",
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
      },
    });
  }

  /** Find leave by ID with user relation included. */
  async findByIdWithUser(id: string, tenantId: string) {
    return prisma.leaveRequest.findUnique({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            workingHourMode: true,
            workDays: true,
            tenantId: true,
            joinDate: true,
            siteId: true,
            departmentId: true,
          },
        },
      },
    });
  }

  /** Find approved leaves in a date range with user relation included. */
  async findApprovedInRangeWithUser(
    startDate: Date,
    endDate: Date,
    tenantId: string,
    userId?: string,
  ) {
    return prisma.leaveRequest.findMany({
      where: {
        tenantId,
        status: "APPROVED",
        ...(userId ? { userId } : {}),
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: { user: true },
    });
  }
}
