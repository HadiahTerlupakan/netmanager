import { Prisma } from "@prisma/client";

import type { AttendanceEvaluationResult } from "../types/AttendanceEvaluation";
import { AttendanceRepository } from "../repositories/AttendanceRepository";

type RecordEvaluationChangeInput = {
  previous: AttendanceEvaluationResult | null;
  next: AttendanceEvaluationResult;
  reason: string;
  actorType: string;
  actorId?: string | null;
};

type AttendanceEvaluationRepository = Pick<
  AttendanceRepository,
  "recordEvaluationChange"
>;

function normalizeRequiredJsonValue(value: unknown): Prisma.InputJsonValue {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("Attendance evaluation JSON harus valid");
  }

  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

function normalizeNullableJsonValue(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null) {
    return Prisma.DbNull;
  }

  return normalizeRequiredJsonValue(value);
}

function toEvaluationPersistence(input: AttendanceEvaluationResult) {
  return {
    ...buildEvaluationIdentity(input),
    ...buildEvaluationStates(input),
    ...buildEvaluationMetrics(input),
    ...buildEvaluationJsonRefs(input),
    evaluationVersion: input.evaluationVersion,
    evaluatedAt: input.evaluatedAt ?? new Date(),
  };
}

function buildEvaluationIdentity(input: AttendanceEvaluationResult) {
  return {
    tenantId: input.tenantId,
    userId: input.userId,
    workDate: input.workDate,
  };
}

function buildEvaluationStates(input: AttendanceEvaluationResult) {
  return {
    finalStatus: input.finalStatus,
    reviewState: input.reviewState,
    rawPresenceState: input.rawPresenceState,
    payrollHoldState: input.payrollHoldState,
    holidayState: input.holidayState,
    leaveState: input.leaveState,
    scheduleState: input.scheduleState,
    evidenceQuality: input.evidenceQuality,
  };
}

function buildEvaluationMetrics(input: AttendanceEvaluationResult) {
  return {
    workMinutes: input.workMinutes,
    lateMinutes: input.lateMinutes,
    overtimeMinutesApproved: input.overtimeMinutesApproved,
    overtimeMinutesHeld: input.overtimeMinutesHeld,
  };
}

function buildEvaluationJsonRefs(input: AttendanceEvaluationResult) {
  return {
    reasonCodes: normalizeRequiredJsonValue(input.reasonCodes),
    anomalyCodes: normalizeRequiredJsonValue(input.anomalyCodes),
    sourceRefs: normalizeRequiredJsonValue(input.sourceRefs),
  };
}

function toAuditPersistence(
  evaluationId: string,
  input: RecordEvaluationChangeInput,
) {
  return {
    evaluationId,
    tenantId: input.next.tenantId,
    userId: input.next.userId,
    workDate: input.next.workDate,
    action: "UPSERT_EVALUATION",
    previousSnapshot: normalizeNullableJsonValue(input.previous),
    nextSnapshot: normalizeNullableJsonValue(input.next),
    reason: input.reason,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    evaluationVersion: input.next.evaluationVersion,
    createdAt: new Date(),
  };
}

function toAuditPersistenceWithoutEvaluationId(
  input: RecordEvaluationChangeInput,
) {
  const { evaluationId: _evaluationId, ...audit } = toAuditPersistence(
    "",
    input,
  );
  return audit;
}

export class AttendanceEvaluationAuditService {
  constructor(
    private readonly attendanceRepo: AttendanceEvaluationRepository = new AttendanceRepository(),
  ) {}

  /** Menyimpan evaluasi canonical beserta audit trail perubahan. */
  async recordEvaluationChange(input: RecordEvaluationChangeInput) {
    return this.attendanceRepo.recordEvaluationChange({
      evaluation: toEvaluationPersistence(input.next),
      audit: toAuditPersistenceWithoutEvaluationId(input),
    });
  }
}
