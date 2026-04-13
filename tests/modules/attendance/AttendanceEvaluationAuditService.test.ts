import { describe, expect, it, vi } from "vitest";

import type { AttendanceEvaluationResult } from "@/modules/attendance/types/AttendanceEvaluation";
import { prismaMock } from "../../setup";
import { AttendanceRepository } from "@/modules/attendance/repositories/AttendanceRepository";
import { AttendanceEvaluationAuditService } from "@/modules/attendance/services/AttendanceEvaluationAuditService";

type EvaluationChangeInput = {
  previous: AttendanceEvaluationResult | null;
  next: AttendanceEvaluationResult;
  reason: string;
  actorType: string;
  actorId?: string | null;
};

const evaluationChangeInput: EvaluationChangeInput = {
  previous: {
    tenantId: "tenant-1",
    userId: "user-1",
    workDate: new Date("2026-04-01T00:00:00.000Z"),
    finalStatus: "ON_TIME",
    reviewState: "FINAL",
    rawPresenceState: "ATTENDANCE_RECORDED",
    workMinutes: 480,
    lateMinutes: 0,
    overtimeMinutesApproved: 0,
    overtimeMinutesHeld: 0,
    payrollHoldState: "NONE",
    holidayState: null,
    leaveState: null,
    scheduleState: "FIXED",
    evidenceQuality: null,
    reasonCodes: [],
    anomalyCodes: [],
    sourceRefs: {},
    evaluationVersion: 1,
  },
  next: {
    tenantId: "tenant-1",
    userId: "user-1",
    workDate: new Date("2026-04-01T00:00:00.000Z"),
    finalStatus: "PERMIT",
    reviewState: "PENDING_REVIEW",
    rawPresenceState: "ATTENDANCE_RECORDED",
    workMinutes: 480,
    lateMinutes: 0,
    overtimeMinutesApproved: 0,
    overtimeMinutesHeld: 0,
    payrollHoldState: "NONE",
    holidayState: null,
    leaveState: "CUTI",
    scheduleState: "FIXED",
    evidenceQuality: null,
    reasonCodes: ["historical-recompute"],
    anomalyCodes: ["ATTENDANCE_RECORDED_DURING_APPROVED_LEAVE"],
    sourceRefs: {},
    evaluationVersion: 2,
  },
  reason: "historical recompute",
  actorType: "SYSTEM",
};

describe("AttendanceEvaluationAuditService", () => {
  it("delegates evaluation and audit persistence as one atomic repository write", async () => {
    const repository = {
      recordEvaluationChange: vi
        .fn()
        .mockResolvedValue({ id: "eval-1", evaluationVersion: 2 }),
    };

    await new AttendanceEvaluationAuditService(
      repository as never,
    ).recordEvaluationChange(evaluationChangeInput);

    expect(repository.recordEvaluationChange).toHaveBeenCalledTimes(1);
  });
});

describe("AttendanceRepository evaluation audit persistence", () => {
  it("writes evaluation and audit inside one transaction", async () => {
    const transactionClient = {
      attendanceEvaluation: {
        upsert: vi.fn().mockResolvedValue({
          id: "eval-1",
          evaluationVersion: 2,
        }),
      },
      attendanceEvaluationAudit: {
        create: vi.fn().mockResolvedValue({
          id: "audit-1",
        }),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );

    const repository = new AttendanceRepository();
    await repository.recordEvaluationChange({
      evaluation: {
        tenantId: evaluationChangeInput.next.tenantId,
        userId: evaluationChangeInput.next.userId,
        workDate: evaluationChangeInput.next.workDate,
        finalStatus: evaluationChangeInput.next.finalStatus,
        reviewState: evaluationChangeInput.next.reviewState,
        rawPresenceState: evaluationChangeInput.next.rawPresenceState,
        workMinutes: evaluationChangeInput.next.workMinutes,
        lateMinutes: evaluationChangeInput.next.lateMinutes,
        overtimeMinutesApproved:
          evaluationChangeInput.next.overtimeMinutesApproved,
        overtimeMinutesHeld: evaluationChangeInput.next.overtimeMinutesHeld,
        payrollHoldState: evaluationChangeInput.next.payrollHoldState,
        holidayState: evaluationChangeInput.next.holidayState,
        leaveState: evaluationChangeInput.next.leaveState,
        scheduleState: evaluationChangeInput.next.scheduleState,
        evidenceQuality: evaluationChangeInput.next.evidenceQuality,
        reasonCodes: evaluationChangeInput.next.reasonCodes as never,
        anomalyCodes: evaluationChangeInput.next.anomalyCodes as never,
        sourceRefs: evaluationChangeInput.next.sourceRefs as never,
        evaluationVersion: evaluationChangeInput.next.evaluationVersion,
        evaluatedAt: new Date("2026-04-01T02:20:00.000Z"),
      },
      audit: {
        tenantId: evaluationChangeInput.next.tenantId,
        userId: evaluationChangeInput.next.userId,
        workDate: evaluationChangeInput.next.workDate,
        action: "UPSERT_EVALUATION",
        previousSnapshot: evaluationChangeInput.previous as never,
        nextSnapshot: evaluationChangeInput.next as never,
        reason: evaluationChangeInput.reason,
        actorType: evaluationChangeInput.actorType,
        actorId: null,
        evaluationVersion: evaluationChangeInput.next.evaluationVersion,
        createdAt: new Date("2026-04-01T02:20:00.000Z"),
      },
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionClient.attendanceEvaluation.upsert).toHaveBeenCalledTimes(
      1,
    );
    expect(
      transactionClient.attendanceEvaluationAudit.create,
    ).toHaveBeenCalledTimes(1);
    expect(
      transactionClient.attendanceEvaluationAudit.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        evaluationId: "eval-1",
      }),
    });
  });
});
