import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export class AttendanceEvaluationRepository {
  async findLatestEvaluationForUser(params: {
    userId: string;
    tenantId?: string;
    workDate?: Date;
  }) {
    return prisma.attendanceEvaluation.findFirst({
      where: {
        userId: params.userId,
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
        ...(params.workDate ? { workDate: params.workDate } : {}),
      },
      orderBy: { evaluatedAt: "desc" },
    });
  }

  async findManyEvaluationLookups(params: {
    tenantId: string;
    userIds: string[];
    workDates: Date[];
  }) {
    if (params.userIds.length === 0 || params.workDates.length === 0) {
      return [];
    }

    return prisma.attendanceEvaluation.findMany({
      where: {
        tenantId: params.tenantId,
        userId: { in: params.userIds },
        workDate: { in: params.workDates },
      },
      select: {
        tenantId: true,
        userId: true,
        workDate: true,
        finalStatus: true,
        reviewState: true,
        leaveState: true,
        holidayState: true,
        payrollHoldState: true,
        evidenceQuality: true,
        reasonCodes: true,
        anomalyCodes: true,
      },
    });
  }

  async findManyPayrollEvaluationsByUserAndDateRange(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
    tenantId?: string;
  }) {
    return prisma.attendanceEvaluation.findMany({
      where: {
        userId: params.userId,
        workDate: { gte: params.startDate, lte: params.endDate },
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      },
      orderBy: { workDate: "asc" },
      select: {
        workDate: true,
        finalStatus: true,
        holidayState: true,
        overtimeMinutesApproved: true,
        overtimeMinutesHeld: true,
        payrollHoldState: true,
      },
    });
  }

  async upsertAttendanceEvaluation(
    data: Prisma.AttendanceEvaluationUncheckedCreateInput,
  ) {
    return prisma.attendanceEvaluation.upsert({
      where: {
        tenantId_userId_workDate: {
          tenantId: data.tenantId,
          userId: data.userId,
          workDate: data.workDate,
        },
      },
      create: data,
      update: data,
    });
  }

  async createAttendanceEvaluationAudit(
    data: Prisma.AttendanceEvaluationAuditUncheckedCreateInput,
  ) {
    return prisma.attendanceEvaluationAudit.create({ data });
  }

  async recordEvaluationChange(data: {
    evaluation: Prisma.AttendanceEvaluationUncheckedCreateInput;
    audit: Omit<
      Prisma.AttendanceEvaluationAuditUncheckedCreateInput,
      "evaluationId"
    >;
  }) {
    return prisma.$transaction(async (tx) => {
      const evaluation = await tx.attendanceEvaluation.upsert({
        where: {
          tenantId_userId_workDate: {
            tenantId: data.evaluation.tenantId,
            userId: data.evaluation.userId,
            workDate: data.evaluation.workDate,
          },
        },
        create: data.evaluation,
        update: data.evaluation,
      });

      await tx.attendanceEvaluationAudit.create({
        data: {
          ...data.audit,
          evaluationId: evaluation.id,
        },
      });

      return evaluation;
    });
  }
}
