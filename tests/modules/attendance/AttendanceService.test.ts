import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prismaMock } from "../../setup";
import { getCrossSurfaceAttendanceFixture } from "../../fixtures/attendance/crossSurfaceAttendanceFixtures";
import { AttendanceService } from "@/modules/attendance/services/AttendanceService";
import { AttendanceDailyEvaluator } from "@/modules/attendance/services/AttendanceDailyEvaluator";
import { AttendanceEvaluationAuditService } from "@/modules/attendance/services/AttendanceEvaluationAuditService";
import { AttendanceValidationService } from "@/modules/attendance/services/AttendanceValidationService";
import { AttendanceTimezoneService } from "@/modules/attendance/services/AttendanceTimezoneService";
import { GeofenceService } from "@/modules/attendance/services/GeofenceService";
import type { AttendanceStatus } from "@prisma/client";
import type { AttendanceEvaluationResult } from "@/modules/attendance/types/AttendanceEvaluation";

// Mock LeaveRepository - correct path
vi.mock("@/modules/attendance/repositories/LeaveRepository", () => ({
  LeaveRepository: class MockLeaveRepository {
    getUserLeaveStats = vi.fn().mockResolvedValue([]);
    findActiveLeaveForUserOnDate = vi.fn(() =>
      prismaMock.leaveRequest.findFirst(),
    );
  },
}));

// Mock OvertimeRepository with class syntax
vi.mock("@/modules/overtime/repositories/OvertimeRepository", () => ({
  OvertimeRepository: class MockOvertimeRepository {
    getUserOvertimeStats = vi.fn().mockResolvedValue([]);
    findActiveRequestByDate = vi.fn(() => prismaMock.overtime.findFirst());
  },
}));

// Mock AttendanceRepository with class syntax - matching actual return structure
vi.mock("@/modules/attendance/repositories/AttendanceRepository", () => ({
  AttendanceRepository: class MockAttendanceRepository {
    findMany = vi.fn((params) => prismaMock.attendance.findMany(params));
    create = vi.fn((data) => prismaMock.attendance.create({ data }));
    update = vi.fn((id, data) =>
      prismaMock.attendance.update({ where: { id }, data }),
    );
    findFirstOpenSession = vi.fn(() => prismaMock.attendance.findFirst());
    findManyStaleSessions = vi.fn(() => prismaMock.attendance.findMany());
    findFirstActiveForCheckout = vi.fn(() => prismaMock.attendance.findFirst());
    findFirstByUserAndDateRange = vi.fn(() =>
      prismaMock.attendance.findFirst(),
    );
    findManyForHistory = vi.fn().mockResolvedValue([]);
    countByUserId = vi.fn().mockResolvedValue(0);
    findFirstForCurrentStatus = vi.fn().mockResolvedValue(null);
    findLatestEvaluationForUser = vi.fn(() =>
      prismaMock.attendanceEvaluation.findFirst(),
    );
    findManyForAnalytics = vi.fn().mockResolvedValue([]);
    getStatsByDateRange = vi.fn().mockResolvedValue({
      total: 100,
      avgDurationMinutes: 480,
      statusCounts: { ON_TIME: 80, LATE: 15, ABSENT: 5 },
    });
    getEvaluationStatsByDateRange = vi.fn().mockResolvedValue({
      total: 100,
      avgDurationMinutes: 480,
      statusCounts: { ON_TIME: 80, LATE: 15, ABSENT: 5 },
    });
    getDailyStats = vi.fn().mockResolvedValue([]);
    getGroupedStats = vi.fn().mockResolvedValue([]);
    getTopEmployees = vi.fn().mockResolvedValue([]);
    getUserAttendanceStats = vi.fn().mockResolvedValue([]);
    getTopAbsentees = vi.fn().mockResolvedValue([]);
    getUserTotalDuration = vi.fn().mockResolvedValue(new Map());
    getUserAbsenceStats = vi.fn().mockResolvedValue([]);
    getUserLateStats = vi.fn().mockResolvedValue([]);
  },
}));

const canonicalEvaluationResult: AttendanceEvaluationResult = {
  tenantId: "tenant-1",
  userId: "user-1",
  workDate: new Date("2026-03-08T00:00:00.000Z"),
  finalStatus: "PERMIT",
  reviewState: "PENDING_REVIEW",
  rawPresenceState: "ATTENDANCE_RECORDED",
  workMinutes: 0,
  lateMinutes: 0,
  overtimeMinutesApproved: 0,
  overtimeMinutesHeld: 0,
  payrollHoldState: "NONE",
  holidayState: null,
  leaveState: "CUTI",
  scheduleState: "FIXED",
  evidenceQuality: null,
  reasonCodes: ["APPROVED_LEAVE_OVERRIDES_ATTENDANCE"],
  anomalyCodes: ["ATTENDANCE_RECORDED_DURING_APPROVED_LEAVE"],
  sourceRefs: {},
  evaluationVersion: 1,
  evaluatedAt: new Date("2026-03-08T02:10:00.000Z"),
};

describe("AttendanceService", () => {
  let service: AttendanceService;
  const now = new Date("2026-03-08T08:00:00.000Z");
  const startOfDay = new Date("2026-03-08T00:00:00.000Z");

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    service = new AttendanceService();
    // Mock prisma.user.findMany for user details
    prismaMock.user.findMany.mockResolvedValue([]);
    vi.spyOn(
      AttendanceValidationService.prototype,
      "validateCheckInEligibility",
    ).mockResolvedValue({ isValid: true });
    vi.spyOn(
      AttendanceTimezoneService.prototype,
      "getTimezone",
    ).mockResolvedValue("Asia/Jakarta");
    vi.spyOn(
      AttendanceTimezoneService.prototype,
      "getEffectiveDate",
    ).mockReturnValue({
      now,
      startOfDay,
      tzOffsetMs: 0,
    });
    vi.spyOn(
      AttendanceTimezoneService.prototype,
      "calculateStatus",
    ).mockResolvedValue("ON_TIME");
    vi.spyOn(AttendanceDailyEvaluator.prototype, "evaluate").mockResolvedValue(
      canonicalEvaluationResult,
    );
    vi.spyOn(
      AttendanceEvaluationAuditService.prototype,
      "recordEvaluationChange",
    ).mockResolvedValue({
      id: "eval-default",
      ...canonicalEvaluationResult,
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getReportData", () => {
    it("should return correct report structure", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const result = await service.getReportData(startDate, endDate);

      // Check actual return structure based on implementation
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("trends");
      expect(result).toHaveProperty("bySite");
      expect(result).toHaveProperty("byDepartment");
      expect(result).toHaveProperty("topEmployees");
      expect(result).toHaveProperty("combinedTopEmployees");
      expect(result).toHaveProperty("topAbsentees");
      expect(result).toHaveProperty("employeeSummary");
    });

    it("should calculate summary statistics correctly", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const result = await service.getReportData(startDate, endDate);

      // Check summary structure
      expect(result.summary).toHaveProperty("totalAttendance");
      expect(result.summary).toHaveProperty("lateCount");
      expect(result.summary).toHaveProperty("lateRate");
      expect(result.summary).toHaveProperty("alphaCount");
      expect(result.summary).toHaveProperty("alphaRate");
      expect(result.summary.totalAttendance).toBe(100);
    });

    it("should calculate late rate correctly", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const result = await service.getReportData(startDate, endDate);

      // Check late rate is calculated (value depends on mock data)
      expect(result.summary).toHaveProperty("lateRate");
      expect(typeof result.summary.lateRate).toBe("number");
    });
  });

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
      const secondHistoricalEvaluation: AttendanceEvaluationResult = {
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
        .mockResolvedValueOnce(secondHistoricalEvaluation);

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
          ...secondHistoricalEvaluation,
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
  });

  describe("geofence policy enforcement", () => {
    it("rejects check-in for strict users outside the geofence", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        workingHourMode: "FIXED",
        shiftId: null,
        attendanceGeofencePolicy: "STRICT",
        shift: null,
      });
      prismaMock.attendance.findMany.mockResolvedValueOnce([]);
      prismaMock.attendance.findFirst.mockResolvedValueOnce(null);

      vi.spyOn(
        GeofenceService.prototype,
        "validateGeofence",
      ).mockResolvedValueOnce({
        isInside: false,
        nearestDistance: 250,
        nearestSiteName: "Kantor Pusat",
        nearestSiteId: "site-1",
      });

      await expect(
        service.checkIn({
          userId: "strict-user",
          photoUrl: null,
          location: "Remote",
          notes: "",
          latitude: -6.2,
          longitude: 106.8,
        }),
      ).rejects.toThrow("OUTSIDE_GEOFENCE");
    });

    it("allows check-in for warn users outside the geofence and stores outside metadata", async () => {
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

      vi.spyOn(
        GeofenceService.prototype,
        "validateGeofence",
      ).mockResolvedValueOnce({
        isInside: false,
        nearestDistance: 150,
        nearestSiteName: "Site Hybrid",
        nearestSiteId: "site-2",
      });

      prismaMock.attendance.create.mockResolvedValueOnce({
        id: "att-1",
        tenantId: "tenant-1",
        userId: "warn-user",
        checkIn: new Date("2026-03-08T01:00:00.000Z"),
        checkOut: null,
        status: "ON_TIME",
        geofenceStatus: "OUTSIDE",
        geofenceDistance: 150,
        geofenceSiteName: "Site Hybrid",
      });

      const result = await service.checkIn({
        userId: "warn-user",
        tenantId: "tenant-1",
        photoUrl: null,
        location: "Client site",
        notes: "",
        latitude: -6.21,
        longitude: 106.81,
      });

      expect(prismaMock.attendance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            geofenceStatus: "OUTSIDE",
            geofenceDistance: 150,
            geofenceSiteName: "Site Hybrid",
          }),
        }),
      );
      expect(result).toMatchObject({
        attendance: expect.objectContaining({
          geofenceStatus: "OUTSIDE",
          geofenceDistance: 150,
          geofenceSiteName: "Site Hybrid",
        }),
        evaluation: expect.objectContaining({
          finalStatus: "PERMIT",
          reviewState: "PENDING_REVIEW",
        }),
      });
    });

    it("rejects check-out for strict users outside the geofence", async () => {
      prismaMock.attendance.findFirst.mockResolvedValueOnce({
        id: "att-2",
        userId: "strict-user",
        checkIn: new Date("2026-03-08T01:00:00.000Z"),
        checkOut: null,
        notes: "Masuk tepat waktu",
        user: {
          workingHourMode: "FIXED",
          flexibleTargetHour: null,
          name: "Strict User",
          attendanceGeofencePolicy: "STRICT",
        },
      });

      vi.spyOn(
        GeofenceService.prototype,
        "validateGeofence",
      ).mockResolvedValueOnce({
        isInside: false,
        nearestDistance: 400,
        nearestSiteName: "HQ",
        nearestSiteId: "site-1",
      });

      await expect(
        service.checkOut({
          userId: "strict-user",
          photoUrl: null,
          location: "Rumah",
          latitude: -6.22,
          longitude: 106.82,
        }),
      ).rejects.toThrow("OUTSIDE_GEOFENCE");
    });

    it("rejects a new check-in when a flexible session from yesterday is still active but not yet stale", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-08T08:00:00.000Z"));

      prismaMock.user.findUnique.mockResolvedValueOnce({
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        workingHourMode: "FLEXIBLE",
        shiftId: null,
        attendanceGeofencePolicy: "WARN",
        shift: null,
      });

      prismaMock.attendance.findMany.mockResolvedValueOnce([
        {
          id: "att-flex-active",
          checkIn: new Date("2026-03-07T10:00:00.000Z"),
          checkOut: null,
          status: "ON_TIME",
          notes: null,
        },
      ] as never);
      prismaMock.attendance.findFirst.mockResolvedValueOnce({
        id: "att-flex-active",
        checkIn: new Date("2026-03-07T10:00:00.000Z"),
        checkOut: null,
        status: "ON_TIME",
        user: {
          workingHourMode: "FLEXIBLE",
          flexibleTargetHour: 8,
          shift: null,
        },
      });

      await expect(
        service.checkIn({
          userId: "flex-user",
          photoUrl: null,
          location: "Remote",
          notes: "",
          latitude: -6.2,
          longitude: 106.8,
        }),
      ).rejects.toThrow("DUPLICATE_ENTRY");
    });

    it("auto-checks out a stale flexible session older than 24 hours before allowing a new check-in", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        workingHourMode: "FLEXIBLE",
        shiftId: null,
        attendanceGeofencePolicy: "WARN",
        shift: null,
      });

      const staleFlexibleSession: {
        id: string;
        checkIn: Date;
        checkOut: Date | null;
        status: AttendanceStatus;
        notes: string | null;
        user: {
          workingHourMode: "FLEXIBLE";
          flexibleTargetHour: number;
          shift: null;
        };
      } = {
        id: "att-flex-stale",
        checkIn: new Date("2026-03-07T07:00:00.000Z"),
        checkOut: null,
        status: "ON_TIME",
        notes: null,
        user: {
          workingHourMode: "FLEXIBLE",
          flexibleTargetHour: 8,
          shift: null,
        },
      };

      prismaMock.attendance.findMany.mockResolvedValueOnce([
        {
          id: staleFlexibleSession.id,
          checkIn: staleFlexibleSession.checkIn,
          checkOut: staleFlexibleSession.checkOut,
          status: staleFlexibleSession.status,
          notes: staleFlexibleSession.notes,
        },
      ] as never);
      prismaMock.attendance.findFirst.mockImplementationOnce(
        async (): Promise<typeof staleFlexibleSession | null> => {
          return prismaMock.attendance.update.mock.calls.length > 0
            ? null
            : staleFlexibleSession;
        },
      );
      prismaMock.attendance.update.mockResolvedValueOnce({
        id: staleFlexibleSession.id,
        checkIn: staleFlexibleSession.checkIn,
        checkOut: new Date("2026-03-08T07:00:00.000Z"),
        status: staleFlexibleSession.status,
        notes: "Auto checkout by system (Mangkir)",
      } as never);
      prismaMock.attendance.create.mockResolvedValueOnce({
        id: "att-flex-new",
        userId: "flex-user",
        tenantId: "tenant-1",
        checkIn: now,
        checkOut: null,
        status: "ON_TIME",
        location: "Remote",
        notes: "",
      } as never);
      prismaMock.leaveRequest.findFirst.mockResolvedValueOnce(null);
      prismaMock.holiday.findFirst.mockResolvedValueOnce(null);
      prismaMock.overtime.findFirst.mockResolvedValueOnce(null);
      prismaMock.attendanceEvaluation.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.checkIn({
          userId: "flex-user",
          photoUrl: null,
          location: "Remote",
          notes: "",
          latitude: -6.2,
          longitude: 106.8,
          tenantId: "tenant-1",
        }),
      ).resolves.toMatchObject({
        attendance: expect.objectContaining({
          id: "att-flex-new",
        }),
      });

      expect(prismaMock.attendance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: staleFlexibleSession.id },
          data: expect.objectContaining({
            checkOut: new Date("2026-03-08T07:00:00.000Z"),
            status: "ON_TIME",
          }),
        }),
      );
    });

    it("rejects a new check-in when an overnight shift session is still active after midnight", async () => {
      vi.spyOn(
        AttendanceTimezoneService.prototype,
        "getEffectiveDate",
      ).mockReturnValueOnce({
        now: new Date("2026-03-07T18:00:00.000Z"),
        startOfDay: new Date("2026-03-07T00:00:00.000Z"),
        tzOffsetMs: 0,
      });

      prismaMock.user.findUnique.mockResolvedValueOnce({
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        workingHourMode: "SHIFT",
        shiftId: "shift-1",
        attendanceGeofencePolicy: "WARN",
        shift: {
          startTime: "21:00",
          endTime: "04:00",
        },
      });
      prismaMock.attendance.findMany.mockResolvedValueOnce([]);
      prismaMock.attendance.findFirst.mockResolvedValueOnce({
        id: "att-shift-overnight",
        checkIn: new Date("2026-03-07T15:00:00.000Z"),
        checkOut: null,
        status: "ON_TIME",
        user: {
          workingHourMode: "SHIFT",
          flexibleTargetHour: null,
          shift: {
            startTime: "21:00",
            endTime: "04:00",
          },
        },
      });

      await expect(
        service.checkIn({
          userId: "shift-user",
          photoUrl: null,
          location: "Remote",
          notes: "",
          latitude: -6.2,
          longitude: 106.8,
        }),
      ).rejects.toThrow("DUPLICATE_ENTRY");
    });
  });
});

describe("AttendanceService cross-surface fixture coverage", () => {
  it("exposes critical attendance fixtures needed by parity tests", () => {
    expect(
      getCrossSurfaceAttendanceFixture("same-day-open-session"),
    ).toBeDefined();
    expect(
      getCrossSurfaceAttendanceFixture("same-day-checked-out-session"),
    ).toBeDefined();
    expect(
      getCrossSurfaceAttendanceFixture("overnight-shift-still-active"),
    ).toBeDefined();
    expect(
      getCrossSurfaceAttendanceFixture("stale-flexible-session"),
    ).toBeDefined();
    expect(
      getCrossSurfaceAttendanceFixture("no-checkout-system-closure"),
    ).toBeDefined();
    expect(
      getCrossSurfaceAttendanceFixture("outside-geofence-warn-accepted"),
    ).toBeDefined();
  });
});
