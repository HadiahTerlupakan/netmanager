import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import type { AttendanceCorrectionSource } from "./AttendanceRepository";

export class AttendanceCorrectionRepository {
  async findCorrectionSourceById(
    id: string,
  ): Promise<AttendanceCorrectionSource | null> {
    return prisma.attendance.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            shift: true,
          },
        },
      },
    });
  }

  async createCorrectedAttendance(data: Prisma.AttendanceUncheckedCreateInput) {
    return prisma.attendance.create({
      data,
    });
  }

  async markAttendanceAsCorrected(input: {
    sourceAttendanceId: string;
    correctedById: string;
    correctionReason: string;
    correctionNotes: string | null;
    correctionEvidencePhotoUrl: string;
    replacementAttendanceId: string;
  }) {
    return prisma.attendance.update({
      where: {
        id: input.sourceAttendanceId,
      },
      data: {
        correctedAt: new Date(),
        correctedById: input.correctedById,
        correctionReason: input.correctionReason,
        correctionNotes: input.correctionNotes,
        correctionEvidencePhotoUrl: input.correctionEvidencePhotoUrl,
        correctionReplacementAttendanceId: input.replacementAttendanceId,
      },
    });
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
    return prisma.$transaction(async (tx) => {
      const createdAttendance = await tx.attendance.create({
        data: {
          ...input.createData,
          id: input.createData.id || randomUUID(),
        },
      });

      const updateResult = await tx.attendance.updateMany({
        where: {
          id: input.sourceAttendanceId,
          correctedAt: null,
          status: { in: ["ABSENT", "ALPHA"] },
        },
        data: {
          correctedAt: new Date(),
          correctedById: input.correctedById,
          correctionReason: input.correctionReason,
          correctionNotes: input.correctionNotes,
          correctionEvidencePhotoUrl: input.correctionEvidencePhotoUrl,
          correctionReplacementAttendanceId: createdAttendance.id,
        },
      });

      if (updateResult.count !== 1) {
        throw new AppError(
          "Record mangkir ini sudah pernah dikoreksi",
          409,
          "CONFLICT",
        );
      }

      if (input.evaluationChange) {
        const evaluation = await tx.attendanceEvaluation.upsert({
          where: {
            tenantId_userId_workDate: {
              tenantId: input.evaluationChange.evaluation.tenantId,
              userId: input.evaluationChange.evaluation.userId,
              workDate: input.evaluationChange.evaluation.workDate,
            },
          },
          create: input.evaluationChange.evaluation,
          update: input.evaluationChange.evaluation,
        });

        await tx.attendanceEvaluationAudit.create({
          data: {
            ...input.evaluationChange.audit,
            evaluationId: evaluation.id,
          },
        });
      }

      return {
        id: createdAttendance.id,
        status: createdAttendance.status,
      };
    });
  }
}
