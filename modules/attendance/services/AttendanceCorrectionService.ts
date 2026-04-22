import { AppError, ValidationError } from "@/lib/errors";
import { getTimezone } from "@/lib/utils/get-timezone";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import { AttendanceStatus, Prisma } from "@prisma/client";
import {
  addDays,
  differenceInMinutes,
  isAfter,
  isBefore,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
  startOfDay as fnsStartOfDay,
  subHours,
} from "date-fns";
import { toDate, toZonedTime } from "date-fns-tz";
import { randomUUID } from "crypto";

import {
  AttendanceRepository,
  type AttendanceCorrectionSource,
} from "../repositories/AttendanceRepository";
import { AttendanceTimezoneService } from "./AttendanceTimezoneService";

type CorrectionSchedule = {
  startTime: string;
  endTime: string;
};

type AttendanceCorrectionResult = {
  sourceAttendanceId: string;
  correctedAttendance: {
    id: string;
    status: AttendanceStatus;
  };
};

type AttendanceCorrectionCreateData = {
  id: string;
  tenantId: string;
  userId: string;
  checkIn: Date;
  checkInDate: Date;
  checkOut: Date;
  checkInPhoto: string;
  status: AttendanceStatus;
  notes: string | null;
  location: string;
  checkOutLocation: string;
  geofenceStatus: string;
  correctionSource: string;
  correctionSourceAttendanceId: string;
  updatedAt: Date;
};

type AttendanceCorrectionEvaluationPayload = {
  evaluation: Prisma.AttendanceEvaluationUncheckedCreateInput;
  audit: Omit<
    Prisma.AttendanceEvaluationAuditUncheckedCreateInput,
    "evaluationId"
  >;
};

type AttendanceCorrectionRepository = {
  findCorrectionSourceById(
    id: string,
  ): Promise<AttendanceCorrectionSource | null>;
  createCorrectedAttendance(
    data: AttendanceCorrectionCreateData,
  ): Promise<{ id: string; status: AttendanceStatus }>;
  markAttendanceAsCorrected(input: {
    sourceAttendanceId: string;
    correctedById: string;
    correctionReason: string;
    correctionNotes: string | null;
    correctionEvidencePhotoUrl: string;
    replacementAttendanceId: string;
  }): Promise<unknown>;
  findLatestEvaluationForUser?: AttendanceRepository["findLatestEvaluationForUser"];
  recordEvaluationChange?: AttendanceRepository["recordEvaluationChange"];
  applyMissedCheckInCorrection?: (input: {
    createData: AttendanceCorrectionCreateData;
    sourceAttendanceId: string;
    correctedById: string;
    correctionReason: string;
    correctionNotes: string | null;
    correctionEvidencePhotoUrl: string;
    evaluationChange?: AttendanceCorrectionEvaluationPayload;
  }) => Promise<{ id: string; status: AttendanceStatus }>;
};

const CHECK_IN_WINDOW_HOURS = 3;
const ALLOW_NON_ATOMIC_CORRECTION_ENV =
  "ALLOW_NON_ATOMIC_ATTENDANCE_CORRECTION";

function parseTime(value: string | null | undefined): string | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

function buildClockTime(workDate: Date, time: string, timezone: string): Date {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const zonedDate = toZonedTime(workDate, timezone);
  let candidate = fnsStartOfDay(zonedDate);

  candidate = setHours(candidate, hour);
  candidate = setMinutes(candidate, minute);
  candidate = setSeconds(candidate, 0);
  candidate = setMilliseconds(candidate, 0);

  return toDate(candidate, { timeZone: timezone });
}

function buildLateMinutes(
  checkIn: Date,
  scheduledStartAt: Date,
  status: AttendanceStatus,
) {
  if (status !== "LATE") {
    return 0;
  }

  return Math.max(0, differenceInMinutes(checkIn, scheduledStartAt));
}

/** Menangani koreksi manual untuk record mangkir agar punya source of truth final. */
export interface CorrectMissedCheckInInput {
  sourceAttendanceId: string;
  tenantId: string;
  actorId: string;
  checkIn: Date;
  checkOut: Date | null;
  reason: string;
  notes: string | null;
  evidencePhotoUrl: string;
}

const createDefaultAttendanceCorrectionRepository =
  (): AttendanceCorrectionRepository => {
    return new AttendanceRepository();
  };

export class AttendanceCorrectionService {
  private readonly timezoneService: AttendanceTimezoneService;

  constructor(
    private readonly attendanceRepo: AttendanceCorrectionRepository = createDefaultAttendanceCorrectionRepository(),
  ) {
    this.timezoneService = new AttendanceTimezoneService();
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

    if (sourceAttendance.user.joinDate) {
      const joinDate = toStartOfDay(sourceAttendance.user.joinDate, timezone);
      if (workDate < joinDate) {
        throw new ValidationError(
          "Absensi sebelum tanggal masuk tidak dapat dikoreksi",
        );
      }
    }

    const schedule = this.resolveSchedule(sourceAttendance);
    const scheduleWindow = this.buildScheduleWindow(
      workDate,
      schedule,
      timezone,
    );

    this.assertCheckInWithinWindow(
      input.checkIn,
      scheduleWindow.windowStart,
      scheduleWindow.endAt,
    );

    const effectiveCheckOut =
      input.checkOut ?? this.buildDefaultCheckOut(scheduleWindow.endAt);

    if (effectiveCheckOut.getTime() < input.checkIn.getTime()) {
      throw new ValidationError(
        "Jam check-out harus lebih besar atau sama dengan jam check-in",
      );
    }

    const finalStatus = await this.timezoneService.calculateStatus(
      input.checkIn,
      schedule.startTime,
      timezone,
    );

    const correctedAttendanceData = {
      id: randomUUID(),
      tenantId: input.tenantId,
      userId: sourceAttendance.userId,
      checkIn: input.checkIn,
      checkInDate: workDate,
      checkOut: effectiveCheckOut,
      checkInPhoto: input.evidencePhotoUrl,
      status: finalStatus,
      notes: input.notes,
      location: "Manual correction by admin",
      checkOutLocation: input.checkOut
        ? "Manual correction by admin"
        : "Auto-filled from schedule",
      geofenceStatus: "MANUAL",
      correctionSource: "ADMIN_MISSED_CHECKIN",
      correctionSourceAttendanceId: sourceAttendance.id,
      updatedAt: new Date(),
    } as const;

    const correctedAttendanceForEvaluation = {
      id: correctedAttendanceData.id,
      status: correctedAttendanceData.status,
      checkIn: correctedAttendanceData.checkIn,
      checkOut: correctedAttendanceData.checkOut,
    };

    const evaluationChange = await this.recomputeCanonicalEvaluation({
      sourceAttendance,
      correctedAttendance: correctedAttendanceForEvaluation,
      tenantId: input.tenantId,
      actorId: input.actorId,
      reason: input.reason,
      workDate,
      scheduleStartAt: scheduleWindow.startAt,
    });

    const correctedAttendance = await this.persistCorrection(
      correctedAttendanceData,
      input,
      sourceAttendance,
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
    sourceAttendance: AttendanceCorrectionSource | null,
    tenantId: string,
  ) {
    if (!sourceAttendance) {
      throw new AppError("Data absensi tidak ditemukan", 404, "NOT_FOUND");
    }

    if (sourceAttendance.tenantId !== tenantId) {
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

  private resolveSchedule(
    sourceAttendance: AttendanceCorrectionSource,
  ): CorrectionSchedule {
    const user = sourceAttendance.user;
    const startTime =
      user.workingHourMode === "SHIFT"
        ? parseTime(user.shift?.startTime ?? user.startWorkTime)
        : parseTime(user.startWorkTime);
    const endTime =
      user.workingHourMode === "SHIFT"
        ? parseTime(user.shift?.endTime ?? user.endWorkTime)
        : parseTime(user.endWorkTime);

    if (!startTime || !endTime) {
      throw new ValidationError(
        "Jadwal kerja karyawan belum lengkap, koreksi manual tidak bisa diproses",
      );
    }

    return {
      startTime,
      endTime,
    };
  }

  private buildScheduleWindow(
    workDate: Date,
    schedule: CorrectionSchedule,
    timezone: string,
  ) {
    const startAt = buildClockTime(workDate, schedule.startTime, timezone);
    let endAt = buildClockTime(workDate, schedule.endTime, timezone);

    if (!isAfter(endAt, startAt)) {
      endAt = addDays(endAt, 1);
    }

    return {
      startAt,
      endAt,
      windowStart: subHours(startAt, CHECK_IN_WINDOW_HOURS),
    };
  }

  private assertCheckInWithinWindow(
    checkIn: Date,
    windowStart: Date,
    windowEnd: Date,
  ) {
    if (isBefore(checkIn, windowStart) || isAfter(checkIn, windowEnd)) {
      throw new ValidationError(
        "Jam check-in berada di luar jendela koreksi yang diizinkan",
      );
    }
  }

  private buildDefaultCheckOut(scheduleEndAt: Date) {
    return new Date(scheduleEndAt);
  }

  private async persistCorrection(
    correctedAttendanceData: AttendanceCorrectionCreateData,
    input: CorrectMissedCheckInInput,
    sourceAttendance: AttendanceCorrectionSource,
    evaluationChange?: AttendanceCorrectionEvaluationPayload,
  ) {
    if (this.attendanceRepo.applyMissedCheckInCorrection) {
      return this.attendanceRepo.applyMissedCheckInCorrection({
        createData: correctedAttendanceData,
        sourceAttendanceId: sourceAttendance.id,
        correctedById: input.actorId,
        correctionReason: input.reason,
        correctionNotes: input.notes,
        correctionEvidencePhotoUrl: input.evidencePhotoUrl,
        evaluationChange,
      });
    }

    this.assertFallbackCorrectionAllowed();

    const correctedAttendance =
      await this.attendanceRepo.createCorrectedAttendance(
        correctedAttendanceData,
      );

    await this.attendanceRepo.markAttendanceAsCorrected({
      sourceAttendanceId: sourceAttendance.id,
      correctedById: input.actorId,
      correctionReason: input.reason,
      correctionNotes: input.notes,
      correctionEvidencePhotoUrl: input.evidencePhotoUrl,
      replacementAttendanceId: correctedAttendance.id,
    });

    if (evaluationChange) {
      await this.attendanceRepo.recordEvaluationChange?.(evaluationChange);
    }

    return correctedAttendance;
  }

  private assertFallbackCorrectionAllowed() {
    if (process.env[ALLOW_NON_ATOMIC_CORRECTION_ENV] === "1") {
      return;
    }

    throw new AppError(
      "Koreksi manual hanya didukung melalui jalur atomik",
      500,
      "ATOMIC_CORRECTION_REQUIRED",
    );
  }

  private async recomputeCanonicalEvaluation(params: {
    sourceAttendance: AttendanceCorrectionSource;
    correctedAttendance: {
      id: string;
      status: AttendanceStatus;
      checkIn: Date;
      checkOut: Date;
    };
    tenantId: string;
    actorId: string;
    reason: string;
    workDate: Date;
    scheduleStartAt: Date;
  }): Promise<AttendanceCorrectionEvaluationPayload | undefined> {
    if (
      !this.attendanceRepo.findLatestEvaluationForUser ||
      !this.attendanceRepo.recordEvaluationChange
    ) {
      return undefined;
    }

    const {
      sourceAttendance,
      correctedAttendance,
      tenantId,
      actorId,
      reason,
      workDate,
      scheduleStartAt,
    } = params;

    const previous = await this.attendanceRepo.findLatestEvaluationForUser({
      userId: sourceAttendance.userId,
      tenantId,
      workDate,
    });

    const evaluatedAt = new Date();
    const evaluationVersion = previous?.evaluationVersion ?? 1;
    const workMinutes = Math.max(
      0,
      Math.round(
        (correctedAttendance.checkOut.getTime() -
          correctedAttendance.checkIn.getTime()) /
          60000,
      ),
    );
    const lateMinutes = buildLateMinutes(
      correctedAttendance.checkIn,
      scheduleStartAt,
      correctedAttendance.status,
    );

    return {
      evaluation: {
        tenantId,
        userId: sourceAttendance.userId,
        workDate,
        finalStatus: correctedAttendance.status,
        reviewState: "FINAL",
        rawPresenceState: "ATTENDANCE_RECORDED",
        workMinutes,
        lateMinutes,
        overtimeMinutesApproved: 0,
        overtimeMinutesHeld: 0,
        payrollHoldState: "NONE",
        holidayState: null,
        leaveState: null,
        scheduleState: sourceAttendance.user.workingHourMode,
        evidenceQuality: null,
        reasonCodes: ["MISSED_CHECKIN_CORRECTED"],
        anomalyCodes: [],
        sourceRefs: {
          attendanceId: correctedAttendance.id,
          correctionSourceAttendanceId: sourceAttendance.id,
          correctionSource: "ADMIN_MISSED_CHECKIN",
        },
        evaluationVersion,
        evaluatedAt,
      },
      audit: {
        tenantId,
        userId: sourceAttendance.userId,
        workDate,
        action: "MISSED_CHECKIN_CORRECTED",
        previousSnapshot: previous ?? null,
        nextSnapshot: {
          attendanceId: correctedAttendance.id,
          finalStatus: correctedAttendance.status,
          correctionSourceAttendanceId: sourceAttendance.id,
          lateMinutes,
        },
        reason,
        actorType: "ADMIN",
        actorId,
        evaluationVersion,
        createdAt: evaluatedAt,
      },
    };
  }
}
