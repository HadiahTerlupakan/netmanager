import type { Prisma } from "../repositories/prisma-boundary";
import type { AttendanceStatus } from "../types/attendance.enums";
import type { AttendanceCorrectionSource } from "../repositories/AttendanceRepository";
import { AttendanceCorrectionScheduleService } from "./AttendanceCorrectionScheduleService";
import type {
  AttendanceCorrectionEvaluationPayload,
  AttendanceCorrectionRepository,
} from "./AttendanceCorrectionTypes";

type CorrectedAttendanceForEvaluation = {
  id: string;
  status: AttendanceStatus;
  checkIn: Date;
  checkOut: Date;
};

export class AttendanceCorrectionEvaluationService {
  constructor(
    private readonly attendanceRepo: AttendanceCorrectionRepository,
    private readonly scheduleService = new AttendanceCorrectionScheduleService(),
  ) {}

  /** Recompute canonical evaluation untuk hasil koreksi missed check-in. */
  async recomputeCanonicalEvaluation(params: {
    sourceAttendance: AttendanceCorrectionSource;
    correctedAttendance: CorrectedAttendanceForEvaluation;
    tenantId: string;
    actorId: string;
    reason: string;
    workDate: Date;
    scheduleStartAt: Date;
  }): Promise<AttendanceCorrectionEvaluationPayload | undefined> {
    if (!this.canRecordEvaluationChange()) return undefined;

    const previous = await this.attendanceRepo.findLatestEvaluationForUser!({
      userId: params.sourceAttendance.userId,
      tenantId: params.tenantId,
      workDate: params.workDate,
    });
    const evaluatedAt = new Date();
    const evaluationVersion = previous?.evaluationVersion ?? 1;
    const lateMinutes = this.scheduleService.buildLateMinutes(
      params.correctedAttendance.checkIn,
      params.scheduleStartAt,
      params.correctedAttendance.status,
    );

    return {
      evaluation: this.buildEvaluation(
        params,
        evaluatedAt,
        evaluationVersion,
        lateMinutes,
      ),
      audit: this.buildAudit(
        params,
        this.toJsonSnapshot(previous),
        evaluatedAt,
        evaluationVersion,
        lateMinutes,
      ),
    };
  }

  private canRecordEvaluationChange() {
    return Boolean(
      this.attendanceRepo.findLatestEvaluationForUser &&
      this.attendanceRepo.recordEvaluationChange,
    );
  }

  private buildEvaluation(
    params: {
      sourceAttendance: AttendanceCorrectionSource;
      correctedAttendance: CorrectedAttendanceForEvaluation;
      tenantId: string;
      workDate: Date;
    },
    evaluatedAt: Date,
    evaluationVersion: number,
    lateMinutes: number,
  ): Prisma.AttendanceEvaluationUncheckedCreateInput {
    return {
      tenantId: params.tenantId,
      userId: params.sourceAttendance.userId,
      workDate: params.workDate,
      finalStatus: params.correctedAttendance.status,
      reviewState: "FINAL",
      rawPresenceState: "ATTENDANCE_RECORDED",
      workMinutes: this.calculateWorkMinutes(params.correctedAttendance),
      lateMinutes,
      overtimeMinutesApproved: 0,
      overtimeMinutesHeld: 0,
      payrollHoldState: "NONE",
      holidayState: null,
      leaveState: null,
      scheduleState: params.sourceAttendance.user.workingHourMode,
      evidenceQuality: null,
      reasonCodes: ["MISSED_CHECKIN_CORRECTED"],
      anomalyCodes: [],
      sourceRefs: {
        attendanceId: params.correctedAttendance.id,
        correctionSourceAttendanceId: params.sourceAttendance.id,
        correctionSource: "ADMIN_MISSED_CHECKIN",
      },
      evaluationVersion,
      evaluatedAt,
    };
  }

  private buildAudit(
    params: {
      sourceAttendance: AttendanceCorrectionSource;
      correctedAttendance: CorrectedAttendanceForEvaluation;
      tenantId: string;
      actorId: string;
      reason: string;
      workDate: Date;
    },
    previous: Prisma.JsonValue | null,
    evaluatedAt: Date,
    evaluationVersion: number,
    lateMinutes: number,
  ): Omit<
    Prisma.AttendanceEvaluationAuditUncheckedCreateInput,
    "evaluationId"
  > {
    return {
      tenantId: params.tenantId,
      userId: params.sourceAttendance.userId,
      workDate: params.workDate,
      action: "MISSED_CHECKIN_CORRECTED",
      previousSnapshot: previous ?? null,
      nextSnapshot: {
        attendanceId: params.correctedAttendance.id,
        finalStatus: params.correctedAttendance.status,
        correctionSourceAttendanceId: params.sourceAttendance.id,
        lateMinutes,
      },
      reason: params.reason,
      actorType: "ADMIN",
      actorId: params.actorId,
      evaluationVersion,
      createdAt: evaluatedAt,
    };
  }

  private calculateWorkMinutes(attendance: CorrectedAttendanceForEvaluation) {
    return Math.max(
      0,
      Math.round(
        (attendance.checkOut.getTime() - attendance.checkIn.getTime()) / 60000,
      ),
    );
  }

  private toJsonSnapshot(value: unknown): Prisma.JsonValue | null {
    if (!value) return null;
    return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
  }
}
