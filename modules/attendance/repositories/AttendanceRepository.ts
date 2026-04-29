import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { AttendanceStatus } from "@prisma/client";
import type { IAttendanceRepository } from "../domain/ports/IAttendanceRepository";
import { getInactiveSessionStatuses } from "./attendance-repository-helpers";
import { AttendanceCorrectionRepository } from "./AttendanceCorrectionRepository";
import { AttendanceEvaluationRepository } from "./AttendanceEvaluationRepository";
import { AttendanceReportRepository } from "./AttendanceReportRepository";

export type AttendanceCorrectionSource = Prisma.AttendanceGetPayload<{
  include: {
    user: {
      include: { shift: true };
    };
  };
}>;

export class AttendanceRepository implements IAttendanceRepository {
  async findUnique<T extends Prisma.AttendanceFindUniqueArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceFindUniqueArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T> | null> {
    return prisma.attendance.findUnique(params);
  }

  async findMany<T extends Prisma.AttendanceFindManyArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceFindManyArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T>[]> {
    return prisma.attendance.findMany(params);
  }

  async findFirst<T extends Prisma.AttendanceFindFirstArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceFindFirstArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T> | null> {
    return prisma.attendance.findFirst(params);
  }

  async updateByArgs<T extends Prisma.AttendanceUpdateArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceUpdateArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T>> {
    return prisma.attendance.update(params);
  }

  async delete<T extends Prisma.AttendanceDeleteArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceDeleteArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T>> {
    return prisma.attendance.delete(params);
  }

  async findFirstWithUser(params: {
    where: Prisma.AttendanceWhereInput;
    orderBy?: Prisma.AttendanceOrderByWithRelationInput;
    userSelect?: {
      workingHourMode?: boolean;
      flexibleTargetHour?: boolean;
      workDays?: boolean;
    };
  }) {
    return prisma.attendance.findFirst({
      where: params.where,
      orderBy: params.orderBy,
      include: {
        user: {
          select: params.userSelect,
        },
      },
    });
  }

  async count(where?: Prisma.AttendanceWhereInput) {
    return prisma.attendance.count({
      ...(where ? { where } : {}),
    });
  }

  private readonly reportRepository = new AttendanceReportRepository();

  async getStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getStatsByDateRange(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  async getEvaluationStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getEvaluationStatsByDateRange(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  async getDailyStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    return this.reportRepository.getDailyStats(
      startDate,
      endDate,
      siteId,
      departmentId,
      tenantId,
    );
  }

  async getGroupedStats(
    startDate: Date,
    endDate: Date,
    groupBy: "department" | "site",
    tenantId?: string,
  ) {
    return this.reportRepository.getGroupedStats(
      startDate,
      endDate,
      groupBy,
      tenantId,
    );
  }

  async getTopEmployees(
    startDate: Date,
    endDate: Date,
    limit: number = 5,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getTopEmployees(
      startDate,
      endDate,
      limit,
      siteId,
      departmentId,
    );
  }

  async getTopAbsentees(
    startDate: Date,
    endDate: Date,
    limit: number = 5,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getTopAbsentees(
      startDate,
      endDate,
      limit,
      siteId,
      departmentId,
    );
  }

  async getUserAttendanceStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    return this.reportRepository.getUserAttendanceStats(
      startDate,
      endDate,
      siteId,
      departmentId,
      tenantId,
    );
  }

  async getUserAbsenceStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getUserAbsenceStats(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  async getUserAttendanceRecords(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getUserAttendanceRecords(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  async getUserTotalDuration(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getUserTotalDuration(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  async getUserLateStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getUserLateStats(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  async findAllOpenSessionsWithUser(
    endOfToday: Date,
    twentyFourHoursAgo: Date,
    tenantId?: string,
  ) {
    return prisma.attendance.findMany({
      where: {
        checkOut: null,
        checkIn: {
          lte: endOfToday,
        },
        ...(tenantId ? { tenantId } : {}),
        status: {
          notIn: [...getInactiveSessionStatuses()],
        },
        OR: [
          {
            user: {
              workingHourMode: {
                not: "FLEXIBLE",
              },
            },
          },
          {
            user: {
              workingHourMode: "FLEXIBLE",
            },
            checkIn: {
              lte: twentyFourHoursAgo,
            },
          },
        ],
      },
      include: {
        user: {
          select: {
            name: true,
            workingHourMode: true,
            startWorkTime: true,
            endWorkTime: true,
            shift: true,
          },
        },
      },
    });
  }

  async findOpenSessionForAutoCheckout(params: {
    attendanceId: string;
    tenantId: string;
  }) {
    return prisma.attendance.findFirst({
      where: {
        id: params.attendanceId,
        tenantId: params.tenantId,
        checkOut: null,
        correctedAt: null,
        status: { notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"] },
      },
      include: {
        user: {
          select: {
            name: true,
            workingHourMode: true,
            startWorkTime: true,
            endWorkTime: true,
            shift: true,
          },
        },
      },
    });
  }

  private readonly correctionRepository = new AttendanceCorrectionRepository();

  async findCorrectionSourceById(
    id: string,
  ): Promise<AttendanceCorrectionSource | null> {
    return this.correctionRepository.findCorrectionSourceById(id);
  }

  async createCorrectedAttendance(data: Prisma.AttendanceUncheckedCreateInput) {
    return this.correctionRepository.createCorrectedAttendance(data);
  }

  async markAttendanceAsCorrected(input: {
    sourceAttendanceId: string;
    correctedById: string;
    correctionReason: string;
    correctionNotes: string | null;
    correctionEvidencePhotoUrl: string;
    replacementAttendanceId: string;
  }) {
    return this.correctionRepository.markAttendanceAsCorrected(input);
  }

  async applyMissedCheckInCorrection(input: {
    createData: Prisma.AttendanceUncheckedCreateInput;
    sourceAttendanceId: string;
    correctedById: string;
    correctionReason: string;
    correctionNotes: string | null;
    correctionEvidencePhotoUrl: string;
    evaluationChange?: {
      evaluation: Prisma.AttendanceEvaluationUncheckedCreateInput;
      audit: Omit<
        Prisma.AttendanceEvaluationAuditUncheckedCreateInput,
        "evaluationId"
      >;
    };
  }) {
    return this.correctionRepository.applyMissedCheckInCorrection(input);
  }

  async updateOpenSessionForAutoCheckout(params: {
    attendanceId: string;
    tenantId: string;
    data: Prisma.AttendanceUpdateInput;
  }) {
    const result = await prisma.attendance.updateMany({
      where: {
        id: params.attendanceId,
        tenantId: params.tenantId,
        checkOut: null,
        correctedAt: null,
        status: { notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"] },
      },
      data: params.data,
    });

    return result.count;
  }

  async update(id: string, data: Prisma.AttendanceUpdateInput) {
    return prisma.attendance.update({
      where: { id },
      data,
    });
  }

  async create(data: Prisma.AttendanceUncheckedCreateInput) {
    return prisma.attendance.create({
      data,
    });
  }

  async findFirstByUserAndDateRange(
    userId: string,
    tenantId: string,
    startOfDay: Date,
    endOfDay: Date,
  ) {
    return prisma.attendance.findFirst({
      where: {
        userId,
        tenantId,
        checkIn: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
  }

  async findCheckedInUserIds(startOfDay: Date, endOfDay: Date) {
    const results = await prisma.attendance.findMany({
      where: {
        checkIn: { gte: startOfDay, lte: endOfDay },
      },
      select: { userId: true },
    });
    return results;
  }

  async findIncompleteCheckOutWithUser(startOfDay: Date, endOfDay: Date) {
    return prisma.attendance.findMany({
      where: {
        checkIn: { gte: startOfDay, lte: endOfDay },
        checkOut: null,
        status: { notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"] },
        user: {
          isActive: true,
          pushToken: { not: null },
          endWorkTime: { not: null },
          workingHourMode: { not: "FLEXIBLE" },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            startWorkTime: true,
            endWorkTime: true,
            workDays: true,
            pushToken: true,
          },
        },
      },
      distinct: ["userId"],
    });
  }

  async findIncompleteCheckOutSelect(startOfDay: Date, endOfDay: Date) {
    return prisma.attendance.findMany({
      where: {
        checkIn: { gte: startOfDay, lte: endOfDay },
        checkOut: null,
        status: { notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"] },
        user: {
          workingHourMode: { not: "FLEXIBLE" },
        },
      },
      select: { userId: true, user: { select: { name: true } } },
    });
  }

  async findActiveFlexibleSessionsWithUser() {
    return prisma.attendance.findMany({
      where: {
        checkOut: null,
        user: {
          isActive: true,
          pushToken: { not: null },
          workingHourMode: "FLEXIBLE",
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            flexibleTargetHour: true,
            pushToken: true,
          },
        },
      },
    });
  }

  async createWithId(data: {
    id: string;
    userId: string;
    tenantId: string;
    checkIn: Date;
    status: AttendanceStatus;
    notes: string;
    location: string;
    updatedAt: Date;
  }) {
    return prisma.attendance.create({
      data: {
        id: data.id,
        userId: data.userId,
        tenantId: data.tenantId,
        checkIn: data.checkIn,
        status: data.status,
        notes: data.notes,
        location: data.location,
        updatedAt: data.updatedAt,
      },
    });
  }

  async deleteMany(where: Prisma.AttendanceWhereInput) {
    return prisma.attendance.deleteMany({ where });
  }

  async findFirstOpenSession(params: { userId: string; tenantId?: string }) {
    return prisma.attendance.findFirst({
      where: {
        userId: params.userId,
        checkOut: null,
        ...(params.tenantId && { tenantId: params.tenantId }),
      },
      orderBy: { checkIn: "desc" },
      include: {
        user: {
          select: {
            workingHourMode: true,
            flexibleTargetHour: true,
            shift: {
              select: {
                startTime: true,
                endTime: true,
              },
            },
          },
        },
      },
    });
  }

  async findManyStaleSessions(params: {
    userId: string;
    effectiveToday: Date;
    tenantId?: string;
  }) {
    return prisma.attendance.findMany({
      where: {
        userId: params.userId,
        checkOut: null,
        status: { notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"] },
        checkIn: { lt: params.effectiveToday },
        ...(params.tenantId && { tenantId: params.tenantId }),
      },
    });
  }

  async findFirstActiveForCheckout(params: {
    userId: string;
    tenantId?: string;
  }) {
    return prisma.attendance.findFirst({
      where: {
        userId: params.userId,
        checkOut: null,
        ...(params.tenantId && { tenantId: params.tenantId }),
      },
      orderBy: { checkIn: "desc" },
      include: {
        user: {
          select: {
            workingHourMode: true,
            attendanceGeofencePolicy: true,
            flexibleTargetHour: true,
            name: true,
          },
        },
      },
    });
  }

  async findFirstForCurrentStatus(params: {
    userId: string;
    tenantId?: string;
  }) {
    return prisma.attendance.findFirst({
      where: {
        userId: params.userId,
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      },
      orderBy: { checkIn: "desc" },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        status: true,
        user: {
          select: {
            workingHourMode: true,
            flexibleTargetHour: true,
            shift: {
              select: {
                startTime: true,
                endTime: true,
              },
            },
          },
        },
      },
    });
  }

  private readonly evaluationRepository = new AttendanceEvaluationRepository();

  async findLatestEvaluationForUser(params: {
    userId: string;
    tenantId?: string;
    workDate?: Date;
  }) {
    return this.evaluationRepository.findLatestEvaluationForUser(params);
  }

  async findManyEvaluationLookups(params: {
    tenantId: string;
    userIds: string[];
    workDates: Date[];
  }) {
    return this.evaluationRepository.findManyEvaluationLookups(params);
  }

  async findManyPayrollEvaluationsByUserAndDateRange(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
    tenantId?: string;
  }) {
    return this.evaluationRepository.findManyPayrollEvaluationsByUserAndDateRange(
      params,
    );
  }

  async findManyForHistory(params: {
    userId: string;
    skip: number;
    take: number;
    joinDate?: Date;
  }) {
    return prisma.attendance.findMany({
      where: {
        userId: params.userId,
        ...(params.joinDate ? { checkIn: { gte: params.joinDate } } : {}),
      },
      orderBy: { checkIn: "desc" },
      take: params.take,
      skip: params.skip,
    });
  }

  async countByUserId(userId: string, joinDate?: Date) {
    return prisma.attendance.count({
      where: {
        userId,
        ...(joinDate ? { checkIn: { gte: joinDate } } : {}),
      },
    });
  }

  async upsertAttendanceEvaluation(
    data: Prisma.AttendanceEvaluationUncheckedCreateInput,
  ) {
    return this.evaluationRepository.upsertAttendanceEvaluation(data);
  }

  async createAttendanceEvaluationAudit(
    data: Prisma.AttendanceEvaluationAuditUncheckedCreateInput,
  ) {
    return this.evaluationRepository.createAttendanceEvaluationAudit(data);
  }

  async recordEvaluationChange(data: {
    evaluation: Prisma.AttendanceEvaluationUncheckedCreateInput;
    audit: Omit<
      Prisma.AttendanceEvaluationAuditUncheckedCreateInput,
      "evaluationId"
    >;
  }) {
    return this.evaluationRepository.recordEvaluationChange(data);
  }

  async findManyForAnalytics(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }) {
    return prisma.attendance.findMany({
      where: {
        userId: params.userId,
        checkIn: { gte: params.startDate, lte: params.endDate },
      },
      orderBy: { checkIn: "desc" },
    });
  }
}
