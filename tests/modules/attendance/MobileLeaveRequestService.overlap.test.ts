import { describe, it, expect, beforeEach, vi } from "vitest";
import { MobileLeaveRequestService } from "@/modules/attendance/services/MobileLeaveRequestService";
import type { ILeaveRepository } from "@/modules/attendance/domain/ports/ILeaveRepository";
import type { ILeaveBalanceRepository } from "@/modules/attendance/domain/ports/ILeaveBalanceRepository";
import type { IHolidayRepository } from "@/modules/attendance/domain/ports/IHolidayRepository";

describe("MobileLeaveRequestService - Overlap Detection", () => {
  let service: MobileLeaveRequestService;
  let mockLeaveRepo: Partial<ILeaveRepository>;
  let mockBalanceRepo: Partial<ILeaveBalanceRepository>;
  let mockHolidayRepo: Partial<IHolidayRepository>;

  beforeEach(() => {
    mockLeaveRepo = {
      findRequesterContext: vi.fn().mockResolvedValue({
        id: "user-1",
        name: "Test User",
        workDays: "Mon,Tue,Wed,Thu,Fri",
        workingHourMode: "FIXED",
        siteId: "site-1",
      }),
      findActiveLeaveForUserOnDate: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "leave-1" }),
    };

    mockBalanceRepo = {
      hasEnoughDays: vi.fn().mockResolvedValue(true),
      getRemainingDays: vi.fn().mockResolvedValue(10),
    };

    mockHolidayRepo = {
      isHoliday: vi.fn().mockResolvedValue({ isHoliday: false, holiday: null }),
    };

    service = new MobileLeaveRequestService(
      mockLeaveRepo as ILeaveRepository,
      mockBalanceRepo as ILeaveBalanceRepository,
      mockHolidayRepo as IHolidayRepository,
    );
  });

  describe("Overlap Detection - Block Scenarios", () => {
    it("should block leave request when overlapping with existing PENDING leave", async () => {
      // Mock existing leave (PENDING)
      mockLeaveRepo.findActiveLeaveForUserOnDate = vi.fn().mockResolvedValue({
        type: "CUTI",
        reason: "Liburan keluarga",
      });

      const input = {
        userId: "user-1",
        tenantId: "tenant-1",
        type: "IZIN",
        startDate: "2026-05-12",
        endDate: "2026-05-14",
        reason: "Keperluan pribadi",
      };

      const result = await service.createLeaveRequest(input);

      // Should return error response
      expect(result).toHaveProperty("status", 400);
      const json = await (result as Response).json();
      expect(json.error).toContain("sudah punya pengajuan");
      expect(json.error).toContain("CUTI");
      expect(json.error).toContain("overlap");
    });

    it("should block leave request when overlapping with existing APPROVED leave", async () => {
      // Mock existing leave (APPROVED)
      mockLeaveRepo.findActiveLeaveForUserOnDate = vi.fn().mockResolvedValue({
        type: "SAKIT",
        reason: "Demam",
      });

      const input = {
        userId: "user-1",
        tenantId: "tenant-1",
        type: "CUTI",
        startDate: "2026-05-10",
        endDate: "2026-05-15",
        reason: "Liburan",
      };

      const result = await service.createLeaveRequest(input);

      expect(result).toHaveProperty("status", 400);
      const json = await (result as Response).json();
      expect(json.error).toContain("sudah punya pengajuan");
      expect(json.error).toContain("SAKIT");
    });

    it("should block when new leave exactly matches existing leave dates", async () => {
      mockLeaveRepo.findActiveLeaveForUserOnDate = vi.fn().mockResolvedValue({
        type: "CUTI",
        reason: "Existing leave",
      });

      const input = {
        userId: "user-1",
        tenantId: "tenant-1",
        type: "CUTI",
        startDate: "2026-05-10",
        endDate: "2026-05-15",
        reason: "Duplicate leave",
      };

      const result = await service.createLeaveRequest(input);

      expect(result).toHaveProperty("status", 400);
      const json = await (result as Response).json();
      expect(json.error).toContain("overlap");
    });

    it("should block when new leave partially overlaps existing leave", async () => {
      // Existing: 10-15 Mei
      // New: 14-20 Mei (overlap di 14-15)
      mockLeaveRepo.findActiveLeaveForUserOnDate = vi.fn().mockResolvedValue({
        type: "CUTI",
        reason: "Existing leave",
      });

      const input = {
        userId: "user-1",
        tenantId: "tenant-1",
        type: "IZIN",
        startDate: "2026-05-14",
        endDate: "2026-05-20",
        reason: "Partial overlap",
      };

      const result = await service.createLeaveRequest(input);

      expect(result).toHaveProperty("status", 400);
    });

    it("should block when new leave is within existing leave range", async () => {
      // Existing: 10-20 Mei
      // New: 12-15 Mei (fully within)
      mockLeaveRepo.findActiveLeaveForUserOnDate = vi.fn().mockResolvedValue({
        type: "CUTI",
        reason: "Long leave",
      });

      const input = {
        userId: "user-1",
        tenantId: "tenant-1",
        type: "IZIN",
        startDate: "2026-05-12",
        endDate: "2026-05-15",
        reason: "Within existing leave",
      };

      const result = await service.createLeaveRequest(input);

      expect(result).toHaveProperty("status", 400);
    });
  });

  describe("Overlap Detection - Allow Scenarios", () => {
    it("should allow leave request when no existing leave", async () => {
      mockLeaveRepo.findActiveLeaveForUserOnDate = vi
        .fn()
        .mockResolvedValue(null);

      const input = {
        userId: "user-1",
        tenantId: "tenant-1",
        type: "CUTI",
        startDate: "2026-05-10",
        endDate: "2026-05-15",
        reason: "Liburan",
      };

      const result = await service.createLeaveRequest(input);

      // Should return success with leave ID
      expect(result).toHaveProperty("id");
      expect(result).not.toHaveProperty("status");
    });

    it("should allow sequential leaves without gap", async () => {
      // Existing: 10-15 Mei
      // New: 16-20 Mei (no overlap, sequential)
      mockLeaveRepo.findActiveLeaveForUserOnDate = vi
        .fn()
        .mockResolvedValue(null);

      const input = {
        userId: "user-1",
        tenantId: "tenant-1",
        type: "CUTI",
        startDate: "2026-05-16",
        endDate: "2026-05-20",
        reason: "Extended leave",
      };

      const result = await service.createLeaveRequest(input);

      expect(result).toHaveProperty("id");
    });

    it("should allow leaves with gap between them", async () => {
      // Existing: 10-15 Mei
      // New: 20-25 Mei (gap: 16-19)
      mockLeaveRepo.findActiveLeaveForUserOnDate = vi
        .fn()
        .mockResolvedValue(null);

      const input = {
        userId: "user-1",
        tenantId: "tenant-1",
        type: "CUTI", // Changed to CUTI to avoid photo requirement
        startDate: "2026-05-20",
        endDate: "2026-05-25",
        reason: "Separate leave",
      };

      const result = await service.createLeaveRequest(input);

      expect(result).toHaveProperty("id");
    });

    it("should allow leave for different user even if dates overlap", async () => {
      // User A has leave 10-15 Mei
      // User B can submit leave 10-15 Mei (different user)
      mockLeaveRepo.findRequesterContext = vi.fn().mockResolvedValue({
        id: "user-2",
        name: "User 2",
        workDays: "Mon,Tue,Wed,Thu,Fri",
        workingHourMode: "FIXED",
        siteId: "site-1",
      });
      mockLeaveRepo.findActiveLeaveForUserOnDate = vi
        .fn()
        .mockResolvedValue(null);

      const input = {
        userId: "user-2",
        tenantId: "tenant-1",
        type: "CUTI",
        startDate: "2026-05-10",
        endDate: "2026-05-15",
        reason: "My leave",
      };

      const result = await service.createLeaveRequest(input);

      expect(result).toHaveProperty("id");
    });
  });

  describe("Error Message Format", () => {
    it("should include leave type and date range in error message", async () => {
      mockLeaveRepo.findActiveLeaveForUserOnDate = vi.fn().mockResolvedValue({
        type: "CUTI",
        reason: "Existing",
      });

      const input = {
        userId: "user-1",
        tenantId: "tenant-1",
        type: "IZIN",
        startDate: "2026-05-10",
        endDate: "2026-05-15",
        reason: "New leave",
      };

      const result = await service.createLeaveRequest(input);
      const json = await (result as Response).json();

      expect(json.error).toContain("CUTI");
      expect(json.error).toContain("10/05/2026");
      expect(json.error).toContain("15/05/2026");
      expect(json.error).toContain("overlap");
    });
  });

  describe("Integration with Other Validations", () => {
    it("should check overlap before quota validation", async () => {
      // Setup: overlap exists AND quota insufficient
      mockLeaveRepo.findActiveLeaveForUserOnDate = vi.fn().mockResolvedValue({
        type: "CUTI",
        reason: "Existing",
      });
      mockBalanceRepo.hasEnoughDays = vi.fn().mockResolvedValue(false);

      const input = {
        userId: "user-1",
        tenantId: "tenant-1",
        type: "CUTI",
        startDate: "2026-05-10",
        endDate: "2026-05-15",
        reason: "Test",
      };

      const result = await service.createLeaveRequest(input);
      const json = await (result as Response).json();

      // Should fail on overlap first, not quota
      expect(json.error).toContain("overlap");
      expect(json.error).not.toContain("Kuota");
    });

    it("should check Tukar Libur rules before overlap", async () => {
      // Setup: invalid Tukar Libur AND overlap exists
      mockLeaveRepo.findActiveLeaveForUserOnDate = vi.fn().mockResolvedValue({
        type: "CUTI",
        reason: "Existing",
      });

      const input = {
        userId: "user-1",
        tenantId: "tenant-1",
        type: "TUKAR_LIBUR",
        startDate: "2026-05-10",
        endDate: "2026-05-10",
        reason: "Tukar libur",
        // Missing replacementDate - invalid
      };

      const result = await service.createLeaveRequest(input);
      const json = await (result as Response).json();

      // Should fail on Tukar Libur validation first
      expect(json.error).not.toContain("overlap");
    });
  });
});
