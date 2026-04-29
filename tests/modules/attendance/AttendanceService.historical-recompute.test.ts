import { describe, expect, it, vi } from "vitest";

import {
  AttendanceDailyEvaluator,
  AttendanceEvaluationAuditService,
  canonicalEvaluationResult,
  prismaMock,
  service,
} from "./AttendanceService.test-setup";

describe("historical attendance evaluation recompute", () => {
  it("recomputes canonical evaluations for attendances within the requested date range and records admin audit trail", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      workingHourMode: "FIXED",
      shiftId: null,
      attendanceGeofencePolicy: "WARN",
      shift: null,
    });
    prismaMock.attendance.findMany.mockResolvedValueOnce([
      {
        id: "att-history-1",
        userId: "user-1",
        tenantId: "tenant-1",
        checkIn: new Date("2026-03-08T01:00:00.000Z"),
        checkOut: new Date("2026-03-08T09:00:00.000Z"),
        status: "ON_TIME",
      },
      {
        id: "att-history-2",
        userId: "user-1",
        tenantId: "tenant-1",
        checkIn: new Date("2026-03-09T01:30:00.000Z"),
        checkOut: new Date("2026-03-09T09:30:00.000Z"),
        status: "LATE",
      },
    ]);
    prismaMock.attendance.findFirst
      .mockResolvedValueOnce({
        id: "att-history-1",
        userId: "user-1",
        tenantId: "tenant-1",
        checkIn: new Date("2026-03-08T01:00:00.000Z"),
        checkOut: new Date("2026-03-08T09:00:00.000Z"),
        status: "ON_TIME",
      })
      .mockResolvedValueOnce({
        id: "att-history-2",
        userId: "user-1",
        tenantId: "tenant-1",
        checkIn: new Date("2026-03-09T01:30:00.000Z"),
        checkOut: new Date("2026-03-09T09:30:00.000Z"),
        status: "LATE",
      });
    prismaMock.leaveRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.holiday.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.overtime.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.attendanceEvaluation.findFirst
      .mockResolvedValueOnce({
        id: "eval-history-prev-1",
        tenantId: "tenant-1",
        userId: "user-1",
        workDate: new Date("2026-03-08T00:00:00.000Z"),
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
        evaluatedAt: new Date("2026-03-08T09:05:00.000Z"),
      })
      .mockResolvedValueOnce(null);

    const firstHistoricalEvaluation: AttendanceEvaluationResult = {
      ...canonicalEvaluationResult,
      workDate: new Date("2026-03-08T00:00:00.000Z"),
      finalStatus: "PERMIT",
    };
    const afterJoinEvaluation: AttendanceEvaluationResult = {
      ...canonicalEvaluationResult,
      workDate: new Date("2026-03-09T00:00:00.000Z"),
      finalStatus: "LATE",
      reviewState: "FINAL",
      rawPresenceState: "ATTENDANCE_RECORDED",
      workMinutes: 450,
      lateMinutes: 30,
      reasonCodes: ["LATE_CHECK_IN"],
      anomalyCodes: [],
    };

    const evaluatorSpy = vi.spyOn(
      AttendanceDailyEvaluator.prototype,
      "evaluate",
    );
    evaluatorSpy.mockReset();
    evaluatorSpy
      .mockResolvedValueOnce(firstHistoricalEvaluation)
      .mockResolvedValueOnce(afterJoinEvaluation);

    const auditSpy = vi.spyOn(
      AttendanceEvaluationAuditService.prototype,
      "recordEvaluationChange",
    );
    auditSpy.mockReset();
    auditSpy
      .mockResolvedValueOnce({
        id: "eval-history-1",
        ...firstHistoricalEvaluation,
      } as never)
      .mockResolvedValueOnce({
        id: "eval-history-2",
        ...afterJoinEvaluation,
      } as never);

    const result = await service.recomputeHistoricalAttendanceEvaluations({
      userId: "user-1",
      tenantId: "tenant-1",
      startDate: new Date("2026-03-08T00:00:00.000Z"),
      endDate: new Date("2026-03-09T23:59:59.999Z"),
      actorId: "admin-1",
    });

    expect(evaluatorSpy).toHaveBeenCalledTimes(2);
    expect(auditSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        previous: expect.objectContaining({
          finalStatus: "ON_TIME",
        }),
        next: expect.objectContaining({
          finalStatus: "PERMIT",
        }),
        reason: "historical attendance recompute",
        actorType: "admin",
        actorId: "admin-1",
      }),
    );
    expect(auditSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        previous: null,
        next: expect.objectContaining({
          finalStatus: "LATE",
          workMinutes: 450,
        }),
        reason: "historical attendance recompute",
        actorType: "admin",
        actorId: "admin-1",
      }),
    );
    expect(result).toMatchObject({
      processedCount: 2,
      evaluations: [
        expect.objectContaining({
          workDate: new Date("2026-03-08T00:00:00.000Z"),
          finalStatus: "PERMIT",
        }),
        expect.objectContaining({
          workDate: new Date("2026-03-09T00:00:00.000Z"),
          finalStatus: "LATE",
          workMinutes: 450,
        }),
      ],
    });
  });

  it("skips historical recompute before user joinDate", async () => {
    const afterJoinEvaluation: AttendanceEvaluationResult = {
      ...canonicalEvaluationResult,
      workDate: new Date("2026-03-09T00:00:00.000Z"),
      finalStatus: "LATE",
      reviewState: "FINAL",
      rawPresenceState: "ATTENDANCE_RECORDED",
      workMinutes: 450,
      lateMinutes: 30,
      reasonCodes: ["LATE_CHECK_IN"],
      anomalyCodes: [],
    };

    prismaMock.user.findUnique.mockResolvedValueOnce({
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      workingHourMode: "FIXED",
      attendanceGeofencePolicy: "WARN",
      shiftId: null,
      shift: null,
      joinDate: new Date("2026-03-09T00:00:00.000Z"),
    } as never);
    prismaMock.attendance.findMany.mockResolvedValueOnce([
      {
        id: "att-before-join",
        tenantId: "tenant-1",
        userId: "user-1",
        checkIn: new Date("2026-03-08T01:00:00.000Z"),
        checkOut: new Date("2026-03-08T10:00:00.000Z"),
        status: "ON_TIME",
      },
      {
        id: "att-after-join",
        tenantId: "tenant-1",
        userId: "user-1",
        checkIn: new Date("2026-03-09T01:00:00.000Z"),
        checkOut: new Date("2026-03-09T10:00:00.000Z"),
        status: "LATE",
      },
    ] as never);

    const evaluatorSpy = vi.spyOn(
      AttendanceDailyEvaluator.prototype,
      "evaluate",
    );
    evaluatorSpy.mockReset();
    evaluatorSpy.mockResolvedValue(afterJoinEvaluation);

    const auditSpy = vi.spyOn(
      AttendanceEvaluationAuditService.prototype,
      "recordEvaluationChange",
    );
    auditSpy.mockReset();
    auditSpy.mockResolvedValueOnce({
      id: "eval-history-after-join",
      ...afterJoinEvaluation,
    } as never);

    const result = await service.recomputeHistoricalAttendanceEvaluations({
      userId: "user-1",
      tenantId: "tenant-1",
      startDate: new Date("2026-03-08T00:00:00.000Z"),
      endDate: new Date("2026-03-09T23:59:59.999Z"),
      actorId: "admin-1",
    });

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(result.processedCount).toBe(1);
    expect(result.evaluations).toHaveLength(1);
    expect(result.evaluations[0]).toMatchObject({
      workDate: new Date("2026-03-09T00:00:00.000Z"),
      finalStatus: "LATE",
    });
  });
});
