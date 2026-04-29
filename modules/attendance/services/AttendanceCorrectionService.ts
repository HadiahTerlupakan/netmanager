import { AppError, ValidationError } from "@/lib/errors";
import { getTimezone } from "@/lib/utils/get-timezone";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import { randomUUID } from "crypto";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { AttendanceCorrectionEvaluationService } from "./AttendanceCorrectionEvaluationService";
import { AttendanceCorrectionScheduleService } from "./AttendanceCorrectionScheduleService";
import type {
  AttendanceCorrectionCreateData,
  AttendanceCorrectionEvaluationPayload,
  AttendanceCorrectionRepository,
  AttendanceCorrectionResult,
  CorrectMissedCheckInInput,
} from "./AttendanceCorrectionTypes";
import { AttendanceTimezoneService } from "./AttendanceTimezoneService";

const ALLOW_NON_ATOMIC_CORRECTION_ENV =
  "ALLOW_NON_ATOMIC_ATTENDANCE_CORRECTION";

const createDefaultAttendanceCorrectionRepository =
  (): AttendanceCorrectionRepository => new AttendanceRepository();

export type { CorrectMissedCheckInInput } from "./AttendanceCorrectionTypes";

export class AttendanceCorrectionService {
  private readonly evaluationService: AttendanceCorrectionEvaluationService;
  private readonly scheduleService = new AttendanceCorrectionScheduleService();
  private readonly timezoneService = new AttendanceTimezoneService();

  constructor(
    private readonly attendanceRepo: AttendanceCorrectionRepository = createDefaultAttendanceCorrectionRepository(),
  ) {
    this.evaluationService = new AttendanceCorrectionEvaluationService(
      attendanceRepo,
      this.scheduleService,
    );
  }

  /** Mengoreksi record ABSENT/ALPHA menjadi record final ON_TIME/LATE. */
  async correctMissedCheckIn(
    input: CorrectMissedCheckInInput,
  ): Promise<AttendanceCorrectionResult> {
    const sourceAttendance = await this.attendanceRepo.findCorrectionSourceById(
      input.sourceAttendanceId,
    );
    this.assertSourceAttendance(sourceAttendance, input.tenantId);

    const timezone = await getTimezone(input.tenantId);
    const workDate = toStartOfDay(sourceAttendance.checkIn, timezone);
    this.assertAfterJoinDate(
      sourceAttendance.user.joinDate,
      workDate,
      timezone,
    );

    const schedule = this.scheduleService.resolveSchedule(sourceAttendance);
    const scheduleWindow = this.scheduleService.buildScheduleWindow(
      workDate,
      schedule,
      timezone,
    );
    this.scheduleService.assertCheckInWithinWindow(
      input.checkIn,
      scheduleWindow.windowStart,
      scheduleWindow.endAt,
    );

    const effectiveCheckOut = input.checkOut ?? new Date(scheduleWindow.endAt);
    this.assertValidCheckout(input.checkIn, effectiveCheckOut);

    const finalStatus = await this.timezoneService.calculateStatus(
      input.checkIn,
      schedule.startTime,
      timezone,
    );
    const correctionData = this.buildCorrectionData({
      input,
      sourceAttendanceId: sourceAttendance.id,
      userId: sourceAttendance.userId,
      workDate,
      effectiveCheckOut,
      finalStatus,
    });
    const evaluationChange =
      await this.evaluationService.recomputeCanonicalEvaluation({
        sourceAttendance,
        correctedAttendance: {
          id: correctionData.id,
          status: correctionData.status,
          checkIn: correctionData.checkIn,
          checkOut: correctionData.checkOut,
        },
        tenantId: input.tenantId,
        actorId: input.actorId,
        reason: input.reason,
        workDate,
        scheduleStartAt: scheduleWindow.startAt,
      });
    const correctedAttendance = await this.persistCorrection(
      correctionData,
      input,
      sourceAttendance.id,
      evaluationChange,
    );

    return {
      sourceAttendanceId: sourceAttendance.id,
      correctedAttendance: {
        id: correctedAttendance.id,
        status: correctedAttendance.status,
      },
    };
  }

  private assertSourceAttendance(
    sourceAttendance: Awaited<
      ReturnType<AttendanceCorrectionRepository["findCorrectionSourceById"]>
    >,
    tenantId: string,
  ): asserts sourceAttendance is NonNullable<typeof sourceAttendance> {
    if (!sourceAttendance || sourceAttendance.tenantId !== tenantId) {
      throw new AppError("Data absensi tidak ditemukan", 404, "NOT_FOUND");
    }
    if (!["ABSENT", "ALPHA"].includes(sourceAttendance.status)) {
      throw new ValidationError("Record sumber harus berstatus mangkir");
    }
    if (sourceAttendance.correctedAt) {
      throw new AppError(
        "Record mangkir ini sudah pernah dikoreksi",
        409,
        "CONFLICT",
      );
    }
  }

  private assertAfterJoinDate(
    joinDate: Date | null,
    workDate: Date,
    timezone: string,
  ) {
    if (!joinDate) return;
    if (workDate < toStartOfDay(joinDate, timezone)) {
      throw new ValidationError(
        "Absensi sebelum tanggal masuk tidak dapat dikoreksi",
      );
    }
  }

  private assertValidCheckout(checkIn: Date, checkOut: Date) {
    if (checkOut.getTime() >= checkIn.getTime()) return;
    throw new ValidationError(
      "Jam check-out harus lebih besar atau sama dengan jam check-in",
    );
  }

  private buildCorrectionData(input: {
    input: CorrectMissedCheckInInput;
    sourceAttendanceId: string;
    userId: string;
    workDate: Date;
    effectiveCheckOut: Date;
    finalStatus: AttendanceCorrectionCreateData["status"];
  }): AttendanceCorrectionCreateData {
    return {
      id: randomUUID(),
      tenantId: input.input.tenantId,
      userId: input.userId,
      checkIn: input.input.checkIn,
      checkInDate: input.workDate,
      checkOut: input.effectiveCheckOut,
      checkInPhoto: input.input.evidencePhotoUrl,
      status: input.finalStatus,
      notes: input.input.notes,
      location: "Manual correction by admin",
      checkOutLocation: input.input.checkOut
        ? "Manual correction by admin"
        : "Auto-filled from schedule",
      geofenceStatus: "MANUAL",
      correctionSource: "ADMIN_MISSED_CHECKIN",
      correctionSourceAttendanceId: input.sourceAttendanceId,
      updatedAt: new Date(),
    };
  }

  private async persistCorrection(
    createData: AttendanceCorrectionCreateData,
    input: CorrectMissedCheckInInput,
    sourceAttendanceId: string,
    evaluationChange?: AttendanceCorrectionEvaluationPayload,
  ) {
    if (this.attendanceRepo.applyMissedCheckInCorrection) {
      return this.attendanceRepo.applyMissedCheckInCorrection({
        createData,
        sourceAttendanceId,
        correctedById: input.actorId,
        correctionReason: input.reason,
        correctionNotes: input.notes,
        correctionEvidencePhotoUrl: input.evidencePhotoUrl,
        evaluationChange,
      });
    }

    this.assertFallbackCorrectionAllowed();
    const correctedAttendance =
      await this.attendanceRepo.createCorrectedAttendance(createData);
    await this.attendanceRepo.markAttendanceAsCorrected({
      sourceAttendanceId,
      correctedById: input.actorId,
      correctionReason: input.reason,
      correctionNotes: input.notes,
      correctionEvidencePhotoUrl: input.evidencePhotoUrl,
      replacementAttendanceId: correctedAttendance.id,
    });
    if (evaluationChange)
      await this.attendanceRepo.recordEvaluationChange?.(evaluationChange);
    return correctedAttendance;
  }

  private assertFallbackCorrectionAllowed() {
    if (process.env[ALLOW_NON_ATOMIC_CORRECTION_ENV] === "1") return;
    throw new AppError(
      "Koreksi manual hanya didukung melalui jalur atomik",
      500,
      "ATOMIC_CORRECTION_REQUIRED",
    );
  }
}
