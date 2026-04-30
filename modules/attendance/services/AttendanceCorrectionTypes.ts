import type { Prisma } from "@prisma/client";
import type { AttendanceStatus } from "../types/attendance.enums";
import type {
  AttendanceRepository,
  AttendanceCorrectionSource,
} from "../repositories/AttendanceRepository";

export type CorrectionSchedule = {
  startTime: string;
  endTime: string;
};

export type AttendanceCorrectionResult = {
  sourceAttendanceId: string;
  correctedAttendance: {
    id: string;
    status: AttendanceStatus;
  };
};

export type AttendanceCorrectionCreateData = {
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

export type AttendanceCorrectionEvaluationPayload = {
  evaluation: Prisma.AttendanceEvaluationUncheckedCreateInput;
  audit: Omit<
    Prisma.AttendanceEvaluationAuditUncheckedCreateInput,
    "evaluationId"
  >;
};

export type AttendanceCorrectionRepository = {
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
