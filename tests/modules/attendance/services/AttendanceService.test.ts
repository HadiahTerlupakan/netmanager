import { describe, it, expect, beforeEach, vi } from "vitest";
import { AttendanceService } from "@/modules/attendance/services/AttendanceService";
import type { AttendanceMutationService } from "@/modules/attendance/services/AttendanceMutationService";
import type { AttendanceReadService } from "@/modules/attendance/services/AttendanceReadService";
import type { AttendanceReportService } from "@/modules/attendance/services/AttendanceReportService";
import type { AttendanceSessionGuardService } from "@/modules/attendance/services/AttendanceSessionGuardService";
import type { AttendanceTimezoneService } from "@/modules/attendance/services/AttendanceTimezoneService";
import type { CheckInParams } from "@/modules/attendance/services/attendance-service.contracts";

// Mock factory
vi.mock(
  "@/modules/attendance/services/attendance-service-dependencies",
  () => ({
    createAttendanceServiceDependencies: vi.fn(),
  }),
);

describe("AttendanceService", () => {
  let attendanceService: AttendanceService;
  let mockMutationService: AttendanceMutationService;
  let mockReadService: AttendanceReadService;
  let mockReportService: AttendanceReportService;
  let mockSessionGuardService: AttendanceSessionGuardService;
  let mockTimezoneService: AttendanceTimezoneService;
  let mockAttendanceRepo: Record<string, unknown>;
  let mockUserRepo: Record<string, unknown>;

  const mockCheckInResult = {
    id: "att-1",
    userId: "user-1",
    checkIn: new Date("2026-05-05T08:00:00Z"),
    checkOut: null as Date | null,
    status: "present",
    tenantId: "tenant-1",
  };

  const mockAttendanceHistory = {
    attendances: [mockCheckInResult],
    total: 1,
    page: 1,
    totalPages: 1,
  };

  beforeEach(async () => {
    // Mock repositories
    mockAttendanceRepo = {
      findMany: vi.fn(),
    };

    mockUserRepo = {
      findAttendanceSettingsById: vi.fn(),
    };

    // Mock services
    mockMutationService = {
      checkIn: vi.fn(),
      checkOut: vi.fn(),
      recomputeAttendanceEvaluation: vi.fn(),
    } as unknown as AttendanceMutationService;

    mockReadService = {
      getAttendanceHistory: vi.fn(),
      getCurrentAttendanceStatus: vi.fn(),
      getAttendanceConfig: vi.fn(),
      getAttendanceAnalytics: vi.fn(),
    } as unknown as AttendanceReadService;

    mockReportService = {
      getReportData: vi.fn(),
    } as unknown as AttendanceReportService;

    mockSessionGuardService = {
      processAutoCheckout: vi.fn(),
    } as unknown as AttendanceSessionGuardService;

    mockTimezoneService = {
      getTimezone: vi.fn(),
    } as unknown as AttendanceTimezoneService;

    // Mock factory
    const { createAttendanceServiceDependencies } =
      await import("@/modules/attendance/services/attendance-service-dependencies");
    vi.mocked(createAttendanceServiceDependencies).mockReturnValue({
      attendanceRepo: mockAttendanceRepo as never,
      timezoneService: mockTimezoneService,
      userRepo: mockUserRepo as never,
      readService: mockReadService,
      reportService: mockReportService,
      mutationService: mockMutationService,
      recomputeService: {} as never,
      sessionGuardService: mockSessionGuardService,
      geofenceService: {} as never,
      validationService: {} as never,
      attendanceEvaluator: {} as never,
      evaluationAuditService: {} as never,
      leaveRepo: {} as never,
      holidayRepo: {} as never,
      overtimeRepo: {} as never,
    });

    attendanceService = new AttendanceService();
  });

  describe("checkIn", () => {
    it("harus delegate checkIn ke mutationService", async () => {
      const params: CheckInParams = {
        userId: "user-1",
        photoUrl: "https://example.com/photo.jpg",
        location: "Office",
        notes: "Check in from office",
        latitude: -6.2088,
        longitude: 106.8456,
        tenantId: "tenant-1",
      };

      vi.mocked(mockMutationService.checkIn).mockResolvedValue(
        mockCheckInResult as never,
      );

      const result = await attendanceService.checkIn(params);

      expect(result).toEqual(mockCheckInResult);
      expect(mockMutationService.checkIn).toHaveBeenCalledWith(params);
    });
  });

  describe("checkOut", () => {
    it("harus delegate checkOut ke mutationService", async () => {
      const params = {
        userId: "user-1",
        photoUrl: "https://example.com/photo.jpg",
        location: "Office",
        latitude: -6.2088,
        longitude: 106.8456,
        tenantId: "tenant-1",
      };

      const mockCheckOutResult = {
        ...mockCheckInResult,
        checkOut: new Date("2026-05-05T17:00:00Z"),
      };

      vi.mocked(mockMutationService.checkOut).mockResolvedValue(
        mockCheckOutResult as never,
      );

      const result = await attendanceService.checkOut(params);

      expect(result).toEqual(mockCheckOutResult);
      expect(mockMutationService.checkOut).toHaveBeenCalledWith(params);
    });
  });

  describe("processAutoCheckout", () => {
    it("harus delegate processAutoCheckout ke sessionGuardService dengan object input", async () => {
      const input = {
        userId: "user-1",
        userDetails: null as null,
        effectiveToday: new Date("2026-05-05"),
        checkInTime: new Date("2026-05-05T08:00:00Z"),
        tenantId: "tenant-1",
        timezone: "Asia/Jakarta",
      };

      vi.mocked(mockSessionGuardService.processAutoCheckout).mockResolvedValue(
        undefined,
      );

      await attendanceService.processAutoCheckout(input);

      expect(mockSessionGuardService.processAutoCheckout).toHaveBeenCalledWith(
        input,
      );
    });

    it("harus delegate processAutoCheckout ke sessionGuardService dengan positional args", async () => {
      const userId = "user-1";
      const userDetails = null as null;
      const effectiveToday = new Date("2026-05-05");
      const checkInTime = new Date("2026-05-05T08:00:00Z");
      const tenantId = "tenant-1";
      const timezone = "Asia/Jakarta";

      vi.mocked(mockSessionGuardService.processAutoCheckout).mockResolvedValue(
        undefined,
      );

      await attendanceService.processAutoCheckout(
        userId,
        userDetails,
        effectiveToday,
        checkInTime,
        tenantId,
        timezone,
      );

      expect(mockSessionGuardService.processAutoCheckout).toHaveBeenCalledWith({
        userId,
        userDetails,
        effectiveToday,
        checkInTime,
        tenantId,
        timezone,
      });
    });
  });

  describe("getReportData", () => {
    it("harus delegate getReportData ke reportService", async () => {
      const startDate = new Date("2026-05-01");
      const endDate = new Date("2026-05-31");
      const siteId = "site-1";
      const departmentId = "dept-1";

      const mockReportData = {
        summary: { total: 100, present: 80, absent: 20 },
        details: [] as never[],
      };

      vi.mocked(mockReportService.getReportData).mockResolvedValue(
        mockReportData as never,
      );

      const result = await attendanceService.getReportData(
        startDate,
        endDate,
        siteId,
        departmentId,
      );

      expect(result).toEqual(mockReportData);
      expect(mockReportService.getReportData).toHaveBeenCalledWith({
        startDate,
        endDate,
        siteId,
        departmentId,
      });
    });
  });

  describe("getAttendanceHistory", () => {
    it("harus delegate getAttendanceHistory ke readService", async () => {
      const userId = "user-1";
      const params = { page: 1, limit: 10 };

      vi.mocked(mockReadService.getAttendanceHistory).mockResolvedValue(
        mockAttendanceHistory as never,
      );

      const result = await attendanceService.getAttendanceHistory(
        userId,
        params,
      );

      expect(result).toEqual(mockAttendanceHistory);
      expect(mockReadService.getAttendanceHistory).toHaveBeenCalledWith(
        userId,
        params,
      );
    });
  });

  describe("getCurrentAttendanceStatus", () => {
    it("harus delegate getCurrentAttendanceStatus ke readService", async () => {
      const userId = "user-1";
      const options = { tenantId: "tenant-1" };

      const mockStatus = {
        isCheckedIn: true,
        currentSession: mockCheckInResult,
      };

      vi.mocked(mockReadService.getCurrentAttendanceStatus).mockResolvedValue(
        mockStatus as never,
      );

      const result = await attendanceService.getCurrentAttendanceStatus(
        userId,
        options,
      );

      expect(result).toEqual(mockStatus);
      expect(mockReadService.getCurrentAttendanceStatus).toHaveBeenCalledWith(
        userId,
        options,
      );
    });
  });

  describe("getAttendanceConfig", () => {
    it("harus delegate getAttendanceConfig ke readService", async () => {
      const userId = "user-1";

      const mockConfig = {
        workingHours: { start: "08:00", end: "17:00" },
        allowedLocations: [] as never[],
      };

      vi.mocked(mockReadService.getAttendanceConfig).mockResolvedValue(
        mockConfig as never,
      );

      const result = await attendanceService.getAttendanceConfig(userId);

      expect(result).toEqual(mockConfig);
      expect(mockReadService.getAttendanceConfig).toHaveBeenCalledWith(userId);
    });
  });

  describe("getAttendanceAnalytics", () => {
    it("harus delegate getAttendanceAnalytics ke readService dengan default days", async () => {
      const userId = "user-1";

      const mockAnalytics = {
        totalDays: 30,
        presentDays: 25,
        absentDays: 5,
      };

      vi.mocked(mockReadService.getAttendanceAnalytics).mockResolvedValue(
        mockAnalytics as never,
      );

      const result = await attendanceService.getAttendanceAnalytics(userId);

      expect(result).toEqual(mockAnalytics);
      expect(mockReadService.getAttendanceAnalytics).toHaveBeenCalledWith(
        userId,
        30,
      );
    });

    it("harus delegate getAttendanceAnalytics ke readService dengan custom days", async () => {
      const userId = "user-1";
      const days = 60;

      const mockAnalytics = {
        totalDays: 60,
        presentDays: 50,
        absentDays: 10,
      };

      vi.mocked(mockReadService.getAttendanceAnalytics).mockResolvedValue(
        mockAnalytics as never,
      );

      const result = await attendanceService.getAttendanceAnalytics(
        userId,
        days,
      );

      expect(result).toEqual(mockAnalytics);
      expect(mockReadService.getAttendanceAnalytics).toHaveBeenCalledWith(
        userId,
        days,
      );
    });
  });

  describe("recomputeHistoricalAttendanceEvaluations", () => {
    it("harus recompute historical attendance evaluations", async () => {
      const params = {
        userId: "user-1",
        tenantId: "tenant-1",
        startDate: new Date("2026-05-01"),
        endDate: new Date("2026-05-31"),
        actorId: "admin-1",
      };

      const mockAttendances = [
        {
          id: "att-1",
          userId: "user-1",
          tenantId: "tenant-1",
          checkIn: new Date("2026-05-05T08:00:00Z"),
          checkOut: new Date("2026-05-05T17:00:00Z"),
          status: "present",
        },
      ];

      const mockUserDetails = {
        joinDate: new Date("2026-01-01"),
        workingHourMode: "fixed" as const,
      };

      const mockEvaluation = {
        attendanceId: "att-1",
        status: "present",
        isLate: false,
        isEarlyLeave: false,
      };

      vi.mocked(mockTimezoneService.getTimezone).mockResolvedValue(
        "Asia/Jakarta",
      );
      (
        mockUserRepo.findAttendanceSettingsById as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockUserDetails as never);
      (
        mockAttendanceRepo.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockAttendances as never);
      vi.mocked(
        mockMutationService.recomputeAttendanceEvaluation,
      ).mockResolvedValue(mockEvaluation as never);

      const result =
        await attendanceService.recomputeHistoricalAttendanceEvaluations(
          params,
        );

      expect(result.processedCount).toBe(1);
      expect(result.evaluations).toHaveLength(1);
      expect(mockTimezoneService.getTimezone).toHaveBeenCalledWith(
        params.tenantId,
      );
      expect(mockUserRepo.findAttendanceSettingsById).toHaveBeenCalledWith(
        params.userId,
      );
      expect(mockAttendanceRepo.findMany).toHaveBeenCalled();
      expect(
        mockMutationService.recomputeAttendanceEvaluation,
      ).toHaveBeenCalled();
    });
  });
});
