import type { ReportSiteFilter } from "../domain/report-site-filter";
import { prisma } from "@/lib/prisma";
import {
  toActiveLeaveEntity,
  toTukarLiburDateEntity,
} from "../mappers/AttendanceDomainMapper";

export class LeaveLookupRepository {
  /**
   * Periode izin/sakit/cuti disetujui yang beririsan dengan rentang laporan.
   * Tukar libur bukan izin (hari libur yang dipindah), jadi tidak ikut.
   * Jumlah harinya dihitung di service — dulu laporan menghitung jumlah
   * pengajuan, sehingga cuti 5 hari terbaca 1.
   */
  async findApprovedLeavePeriods(
    startDate: Date,
    endDate: Date,
    siteId?: ReportSiteFilter,
    departmentId?: string,
    tenantId?: string,
  ) {
    return prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        type: { not: "TUKAR_LIBUR" },
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
      select: { userId: true, startDate: true, endDate: true },
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
