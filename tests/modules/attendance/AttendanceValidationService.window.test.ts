import { describe, it, expect, vi, beforeEach } from "vitest";
import { AttendanceValidationService } from "@/modules/attendance/services/AttendanceValidationService";
import { UserLookupService } from "@/modules/users";

describe("AttendanceValidationService - validateCheckInTimeWindow", () => {
  let service: AttendanceValidationService;
  let mockUserRepo: Pick<UserLookupService, "findAttendanceSettingsById">;

  beforeEach(() => {
    mockUserRepo = {
      findAttendanceSettingsById: vi.fn().mockResolvedValue(null),
    };

    service = new AttendanceValidationService(
      undefined,
      undefined,
      mockUserRepo as UserLookupService,
    );
  });

  describe("FIXED mode", () => {
    it("should allow check-in within window (3 hours before work start)", async () => {
      vi.mocked(mockUserRepo.findAttendanceSettingsById).mockResolvedValue({
        workingHourMode: "FIXED",
        startWorkTime: "09:00",
        endWorkTime: "17:00",
        shiftId: null,
        joinDate: new Date("2026-01-01"),
        attendanceGeofencePolicy: "STRICT",
        shift: null,
      });

      const checkInTime = new Date("2026-05-08T01:00:00.000Z"); // 08:00 WIB
      const result = await service.validateCheckInTimeWindow(
        "user-1",
        checkInTime,
        "Asia/Jakarta",
      );

      expect(result.isValid).toBe(true);
    });

    it("should reject check-in before window (too early)", async () => {
      vi.mocked(mockUserRepo.findAttendanceSettingsById).mockResolvedValue({
        workingHourMode: "FIXED",
        startWorkTime: "09:00",
        endWorkTime: "17:00",
        shiftId: null,
        joinDate: new Date("2026-01-01"),
        attendanceGeofencePolicy: "STRICT",
        shift: null,
      });

      const checkInTime = new Date("2026-05-07T22:00:00.000Z"); // 05:00 WIB (before 06:00 window start)
      const result = await service.validateCheckInTimeWindow(
        "user-1",
        checkInTime,
        "Asia/Jakarta",
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("terlalu awal");
      expect(result.reason).toContain("06:00");
    });

    it("should reject check-in after window (too late)", async () => {
      vi.mocked(mockUserRepo.findAttendanceSettingsById).mockResolvedValue({
        workingHourMode: "FIXED",
        startWorkTime: "09:00",
        endWorkTime: "17:00",
        shiftId: null,
        joinDate: new Date("2026-01-01"),
        attendanceGeofencePolicy: "STRICT",
        shift: null,
      });

      const checkInTime = new Date("2026-05-08T11:00:00.000Z"); // 18:00 WIB (after 17:00 window end)
      const result = await service.validateCheckInTimeWindow(
        "user-1",
        checkInTime,
        "Asia/Jakarta",
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("terlalu malam");
      expect(result.reason).toContain("17:00");
    });

    it("should allow check-in at window boundaries", async () => {
      vi.mocked(mockUserRepo.findAttendanceSettingsById).mockResolvedValue({
        workingHourMode: "FIXED",
        startWorkTime: "09:00",
        endWorkTime: "17:00",
        shiftId: null,
        joinDate: new Date("2026-01-01"),
        attendanceGeofencePolicy: "STRICT",
        shift: null,
      });

      // Exactly at window start (06:00 WIB)
      const windowStart = new Date("2026-05-07T23:00:00.000Z");
      const resultStart = await service.validateCheckInTimeWindow(
        "user-1",
        windowStart,
        "Asia/Jakarta",
      );
      expect(resultStart.isValid).toBe(true);

      // Exactly at window end (17:00 WIB)
      const windowEnd = new Date("2026-05-08T10:00:00.000Z");
      const resultEnd = await service.validateCheckInTimeWindow(
        "user-1",
        windowEnd,
        "Asia/Jakarta",
      );
      expect(resultEnd.isValid).toBe(true);
    });
  });

  describe("SHIFT mode", () => {
    it("should allow check-in within window for regular shift", async () => {
      vi.mocked(mockUserRepo.findAttendanceSettingsById).mockResolvedValue({
        workingHourMode: "SHIFT",
        startWorkTime: "08:00",
        endWorkTime: "16:00",
        shiftId: "shift-1",
        joinDate: new Date("2026-01-01"),
        attendanceGeofencePolicy: "STRICT",
        shift: { startTime: "08:00", endTime: "16:00" },
      });

      const checkInTime = new Date("2026-05-08T00:00:00.000Z"); // 07:00 WIB
      const result = await service.validateCheckInTimeWindow(
        "user-1",
        checkInTime,
        "Asia/Jakarta",
      );

      expect(result.isValid).toBe(true);
    });

    it("should handle overnight shift correctly", async () => {
      vi.mocked(mockUserRepo.findAttendanceSettingsById).mockResolvedValue({
        workingHourMode: "SHIFT",
        startWorkTime: "22:00",
        endWorkTime: "06:00",
        shiftId: "shift-night",
        joinDate: new Date("2026-01-01"),
        attendanceGeofencePolicy: "STRICT",
        shift: { startTime: "22:00", endTime: "06:00" },
      });

      // 20:00 WIB (within 19:00-06:00 window)
      const checkInTime = new Date("2026-05-08T13:00:00.000Z");
      const result = await service.validateCheckInTimeWindow(
        "user-1",
        checkInTime,
        "Asia/Jakarta",
      );

      expect(result.isValid).toBe(true);
    });

    it("should reject check-in before overnight shift window", async () => {
      vi.mocked(mockUserRepo.findAttendanceSettingsById).mockResolvedValue({
        workingHourMode: "SHIFT",
        startWorkTime: "22:00",
        endWorkTime: "06:00",
        shiftId: "shift-night",
        joinDate: new Date("2026-01-01"),
        attendanceGeofencePolicy: "STRICT",
        shift: { startTime: "22:00", endTime: "06:00" },
      });

      // 18:00 WIB (before 19:00 window start)
      const checkInTime = new Date("2026-05-08T11:00:00.000Z");
      const result = await service.validateCheckInTimeWindow(
        "user-1",
        checkInTime,
        "Asia/Jakarta",
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("terlalu awal");
    });
  });

  describe("FLEXIBLE mode", () => {
    it("should allow check-in at any time", async () => {
      vi.mocked(mockUserRepo.findAttendanceSettingsById).mockResolvedValue({
        workingHourMode: "FLEXIBLE",
        startWorkTime: null,
        endWorkTime: null,
        shiftId: null,
        joinDate: new Date("2026-01-01"),
        attendanceGeofencePolicy: "STRICT",
        shift: null,
      });

      // 03:00 WIB (very early)
      const checkInTime = new Date("2026-05-07T20:00:00.000Z");
      const result = await service.validateCheckInTimeWindow(
        "user-1",
        checkInTime,
        "Asia/Jakarta",
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe("Missing schedule", () => {
    it("should reject when startWorkTime is missing", async () => {
      vi.mocked(mockUserRepo.findAttendanceSettingsById).mockResolvedValue({
        workingHourMode: "FIXED",
        startWorkTime: null,
        endWorkTime: "17:00",
        shiftId: null,
        joinDate: new Date("2026-01-01"),
        attendanceGeofencePolicy: "STRICT",
        shift: null,
      });

      const checkInTime = new Date("2026-05-08T01:00:00.000Z");
      const result = await service.validateCheckInTimeWindow(
        "user-1",
        checkInTime,
        "Asia/Jakarta",
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Jadwal kerja Anda belum lengkap");
    });

    it("should reject when endWorkTime is missing", async () => {
      vi.mocked(mockUserRepo.findAttendanceSettingsById).mockResolvedValue({
        workingHourMode: "FIXED",
        startWorkTime: "09:00",
        endWorkTime: null,
        shiftId: null,
        joinDate: new Date("2026-01-01"),
        attendanceGeofencePolicy: "STRICT",
        shift: null,
      });

      const checkInTime = new Date("2026-05-08T01:00:00.000Z");
      const result = await service.validateCheckInTimeWindow(
        "user-1",
        checkInTime,
        "Asia/Jakarta",
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Jadwal kerja Anda belum lengkap");
    });
  });

  describe("User not found", () => {
    it("should allow check-in when user not found (graceful degradation)", async () => {
      vi.mocked(mockUserRepo.findAttendanceSettingsById).mockResolvedValue(
        null,
      );

      const checkInTime = new Date("2026-05-08T01:00:00.000Z");
      const result = await service.validateCheckInTimeWindow(
        "user-1",
        checkInTime,
        "Asia/Jakarta",
      );

      expect(result.isValid).toBe(true);
    });
  });
});
