import { describe, expect, it, vi } from "vitest";

import {
  AttendanceDailyEvaluator,
  AttendanceEvaluationAuditService,
  canonicalEvaluationResult,
  prismaMock,
  service,
} from "./AttendanceService.test-setup";

describe("canonical evaluation persistence", () => {
  it("returns canonical evaluation after check-in mutation", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      workingHourMode: "FIXED",
      shiftId: null,
      attendanceGeofencePolicy: "WARN",
      shift: null,
    });
    prismaMock.attendance.findMany.mockResolvedValueOnce([]);
    prismaMock.attendance.findFirst.mockResolvedValueOnce(null);
    prismaMock.attendance.create.mockResolvedValueOnce({
      id: "att-canonical-checkin",
      userId: "user-1",
      tenantId: "tenant-1",
      checkIn: new Date("2026-03-08T01:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      location: "HQ",
      notes: "",
    });
    prismaMock.attendance.findFirst.mockResolvedValueOnce({
      id: "att-canonical-checkin",
      userId: "user-1",
      tenantId: "tenant-1",
      checkIn: new Date("2026-03-08T01:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
    });
    prismaMock.leaveRequest.findFirst.mockResolvedValueOnce({
      type: "CUTI",
      reason: "Approved leave",
    });
    prismaMock.holiday.findFirst.mockResolvedValueOnce(null);
    prismaMock.overtime.findFirst.mockResolvedValueOnce(null);
    prismaMock.attendanceEvaluation.findFirst.mockResolvedValueOnce(null);
    prismaMock.attendanceEvaluation.upsert.mockResolvedValueOnce({
      id: "eval-1",
      ...canonicalEvaluationResult,
    });
    prismaMock.attendanceEvaluationAudit.create.mockResolvedValueOnce({
      id: "audit-1",
    });

    const evaluatorSpy = vi
      .spyOn(AttendanceDailyEvaluator.prototype, "evaluate")
      .mockResolvedValueOnce(canonicalEvaluationResult);
    const auditSpy = vi
      .spyOn(
        AttendanceEvaluationAuditService.prototype,
        "recordEvaluationChange",
      )
      .mockResolvedValueOnce({
        id: "eval-1",
        ...canonicalEvaluationResult,
      } as never);

    const result = await service.checkIn({
      userId: "user-1",
      tenantId: "tenant-1",
      photoUrl: null,
      location: "HQ",
      notes: "",
    });

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        previous: null,
        next: canonicalEvaluationResult,
        reason: "attendance mutation recompute",
      }),
    );
    expect(result).toMatchObject({
      attendance: expect.objectContaining({
        id: "att-canonical-checkin",
      }),
      evaluation: expect.objectContaining({
        finalStatus: "PERMIT",
        reviewState: "PENDING_REVIEW",
        payrollHoldState: "NONE",
      }),
    });
  });

  it("returns canonical evaluation after check-out mutation", async () => {
    prismaMock.attendance.findFirst.mockResolvedValueOnce({
      id: "att-canonical-checkout",
      userId: "user-1",
      tenantId: "tenant-1",
      checkIn: new Date("2026-03-08T01:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      notes: "",
      user: {
        workingHourMode: "FIXED",
        flexibleTargetHour: null,
        attendanceGeofencePolicy: "WARN",
        name: "Test User",
      },
    });
    prismaMock.attendance.update.mockResolvedValueOnce({
      id: "att-canonical-checkout",
      userId: "user-1",
      tenantId: "tenant-1",
      checkIn: new Date("2026-03-08T01:00:00.000Z"),
      checkOut: new Date("2026-03-08T09:00:00.000Z"),
      status: "ON_TIME",
      notes: "",
      user: {
        name: "Test User",
      },
    });
    prismaMock.attendance.findFirst.mockResolvedValueOnce({
      id: "att-canonical-checkout",
      userId: "user-1",
      tenantId: "tenant-1",
      checkIn: new Date("2026-03-08T01:00:00.000Z"),
      checkOut: new Date("2026-03-08T09:00:00.000Z"),
      status: "ON_TIME",
    });
    prismaMock.leaveRequest.findFirst.mockResolvedValueOnce({
      type: "CUTI",
      reason: "Approved leave",
    });
    prismaMock.holiday.findFirst.mockResolvedValueOnce(null);
    prismaMock.overtime.findFirst.mockResolvedValueOnce(null);
    prismaMock.attendanceEvaluation.findFirst.mockResolvedValueOnce({
      id: "eval-prev",
      tenantId: "tenant-1",
      userId: "user-1",
      workDate: new Date("2026-03-08T00:00:00.000Z"),
      finalStatus: "ON_TIME",
      reviewState: "FINAL",
      rawPresenceState: "ATTENDANCE_RECORDED",
      workMinutes: 0,
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
      evaluatedAt: new Date("2026-03-08T01:05:00.000Z"),
    });
    prismaMock.attendanceEvaluation.upsert.mockResolvedValueOnce({
      id: "eval-2",
      ...canonicalEvaluationResult,
    });
    prismaMock.attendanceEvaluationAudit.create.mockResolvedValueOnce({
      id: "audit-2",
    });

    const evaluatorSpy = vi
      .spyOn(AttendanceDailyEvaluator.prototype, "evaluate")
      .mockResolvedValueOnce({
        ...canonicalEvaluationResult,
        workMinutes: 480,
      });
    const auditSpy = vi
      .spyOn(
        AttendanceEvaluationAuditService.prototype,
        "recordEvaluationChange",
      )
      .mockResolvedValueOnce({
        id: "eval-2",
        ...canonicalEvaluationResult,
        workMinutes: 480,
      } as never);

    const result = await service.checkOut({
      userId: "user-1",
      tenantId: "tenant-1",
      photoUrl: null,
      location: "HQ",
    });

    expect(evaluatorSpy).toHaveBeenCalled();
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        previous: expect.objectContaining({
          finalStatus: "ON_TIME",
        }),
        next: expect.objectContaining({
          finalStatus: "PERMIT",
          workMinutes: 480,
        }),
        reason: "attendance mutation recompute",
      }),
    );
    expect(result).toMatchObject({
      attendance: expect.objectContaining({
        id: "att-canonical-checkout",
      }),
      evaluation: expect.objectContaining({
        finalStatus: "PERMIT",
        reviewState: "PENDING_REVIEW",
        workMinutes: 480,
      }),
    });
  });
});
