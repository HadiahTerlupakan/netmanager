import { describe, it, expect, beforeEach, vi } from "vitest";
import { AutoRejectService } from "@/modules/attendance/services/AutoRejectService";
import type { AutoRejectInput } from "@/modules/attendance/services/AutoRejectService";

describe("AutoRejectService", () => {
  const futureDate = (daysFromNow: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  };

  let service: AutoRejectService;

  beforeEach(() => {
    service = new AutoRejectService();
  });

  describe("Rule 1: Insufficient Quota", () => {
    it("should reject if quota is insufficient", async () => {
      const input: AutoRejectInput = {
        userId: "user-1",
        tenantId: "tenant-1",
        leaveType: "CUTI",
        startDate: futureDate(30),
        endDate: futureDate(34),
        leaveDays: 5,
        hasAttachment: false,
      };

      // Mock repository to return insufficient quota
      vi.spyOn(
        service["leaveBalanceRepository"],
        "getRemainingDays",
      ).mockResolvedValue(3);

      const result = await service.shouldAutoReject(input);

      expect(result.autoReject).toBe(true);
      expect(result.reason).toContain("Quota");
      expect(result.reason).toContain("tidak cukup");
    });

    it("should pass if quota is sufficient", async () => {
      const input: AutoRejectInput = {
        userId: "user-1",
        tenantId: "tenant-1",
        leaveType: "CUTI",
        startDate: futureDate(30),
        endDate: futureDate(34),
        leaveDays: 5,
        hasAttachment: false,
      };

      vi.spyOn(
        service["leaveBalanceRepository"],
        "getRemainingDays",
      ).mockResolvedValue(10);
      vi.spyOn(
        service["leaveRepository"],
        "findActiveLeaveForUserOnDate",
      ).mockResolvedValue(null);

      const result = await service.shouldAutoReject(input);

      expect(result.autoReject).toBe(false);
    });

    it("should skip quota check for TUKAR_LIBUR", async () => {
      const input: AutoRejectInput = {
        userId: "user-1",
        tenantId: "tenant-1",
        leaveType: "TUKAR_LIBUR",
        startDate: futureDate(30),
        endDate: futureDate(30),
        leaveDays: 1,
        hasAttachment: false,
        replacementDate: futureDate(44),
      };

      vi.spyOn(
        service["leaveRepository"],
        "findActiveLeaveForUserOnDate",
      ).mockResolvedValue(null);

      const result = await service.shouldAutoReject(input);

      expect(result.autoReject).toBe(false);
    });
  });

  describe("Rule 2: Backdate", () => {
    it("should reject if start date is in the past", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const input: AutoRejectInput = {
        userId: "user-1",
        tenantId: "tenant-1",
        leaveType: "CUTI",
        startDate: yesterday,
        endDate: yesterday,
        leaveDays: 1,
        hasAttachment: false,
      };

      vi.spyOn(
        service["leaveBalanceRepository"],
        "getRemainingDays",
      ).mockResolvedValue(10);

      const result = await service.shouldAutoReject(input);

      expect(result.autoReject).toBe(true);
      expect(result.reason).toContain("sudah lewat");
    });

    it("should pass if start date is today or future", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5); // 5 days in future to pass advance notice

      const input: AutoRejectInput = {
        userId: "user-1",
        tenantId: "tenant-1",
        leaveType: "CUTI",
        startDate: futureDate,
        endDate: futureDate,
        leaveDays: 1,
        hasAttachment: false,
      };

      vi.spyOn(
        service["leaveBalanceRepository"],
        "getRemainingDays",
      ).mockResolvedValue(10);
      vi.spyOn(
        service["leaveRepository"],
        "findActiveLeaveForUserOnDate",
      ).mockResolvedValue(null);

      const result = await service.shouldAutoReject(input);

      expect(result.autoReject).toBe(false);
    });
  });

  describe("Rule 3: Overlap", () => {
    it("should reject if overlaps with existing approved leave", async () => {
      const input: AutoRejectInput = {
        userId: "user-1",
        tenantId: "tenant-1",
        leaveType: "CUTI",
        startDate: futureDate(30),
        endDate: futureDate(34),
        leaveDays: 5,
        hasAttachment: false,
      };

      vi.spyOn(
        service["leaveBalanceRepository"],
        "getRemainingDays",
      ).mockResolvedValue(10);
      vi.spyOn(
        service["leaveRepository"],
        "findActiveLeaveForUserOnDate",
      ).mockResolvedValue({
        id: "existing-leave",
        type: "SAKIT",
      } as never);

      const result = await service.shouldAutoReject(input);

      expect(result.autoReject).toBe(true);
      expect(result.reason).toContain("sudah memiliki");
    });
  });

  describe("Rule 4: Duration Too Long", () => {
    it("should reject if duration exceeds max days", async () => {
      const input: AutoRejectInput = {
        userId: "user-1",
        tenantId: "tenant-1",
        leaveType: "CUTI",
        startDate: futureDate(30),
        endDate: futureDate(49),
        leaveDays: 20,
        hasAttachment: false,
      };

      vi.spyOn(
        service["leaveBalanceRepository"],
        "getRemainingDays",
      ).mockResolvedValue(30);
      vi.spyOn(
        service["leaveRepository"],
        "findActiveLeaveForUserOnDate",
      ).mockResolvedValue(null);

      const result = await service.shouldAutoReject(input);

      expect(result.autoReject).toBe(true);
      expect(result.reason).toContain("maksimal");
    });
  });

  describe("Rule 5: Sakit Without Document", () => {
    it("should reject if sakit > 2 days without attachment", async () => {
      const input: AutoRejectInput = {
        userId: "user-1",
        tenantId: "tenant-1",
        leaveType: "SAKIT",
        startDate: futureDate(30),
        endDate: futureDate(32),
        leaveDays: 3,
        hasAttachment: false,
      };

      vi.spyOn(
        service["leaveBalanceRepository"],
        "getRemainingDays",
      ).mockResolvedValue(10);
      vi.spyOn(
        service["leaveRepository"],
        "findActiveLeaveForUserOnDate",
      ).mockResolvedValue(null);

      const result = await service.shouldAutoReject(input);

      expect(result.autoReject).toBe(true);
      expect(result.reason).toContain("surat dokter");
    });

    it("should pass if sakit > 2 days with attachment", async () => {
      const input: AutoRejectInput = {
        userId: "user-1",
        tenantId: "tenant-1",
        leaveType: "SAKIT",
        startDate: futureDate(30),
        endDate: futureDate(32),
        leaveDays: 3,
        hasAttachment: true,
      };

      vi.spyOn(
        service["leaveBalanceRepository"],
        "getRemainingDays",
      ).mockResolvedValue(10);
      vi.spyOn(
        service["leaveRepository"],
        "findActiveLeaveForUserOnDate",
      ).mockResolvedValue(null);

      const result = await service.shouldAutoReject(input);

      expect(result.autoReject).toBe(false);
    });
  });

  describe("Rule 6: Cuti Without Advance Notice", () => {
    it("should reject if cuti without sufficient advance notice", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const input: AutoRejectInput = {
        userId: "user-1",
        tenantId: "tenant-1",
        leaveType: "CUTI",
        startDate: tomorrow,
        endDate: tomorrow,
        leaveDays: 1,
        hasAttachment: false,
      };

      vi.spyOn(
        service["leaveBalanceRepository"],
        "getRemainingDays",
      ).mockResolvedValue(10);
      vi.spyOn(
        service["leaveRepository"],
        "findActiveLeaveForUserOnDate",
      ).mockResolvedValue(null);

      const result = await service.shouldAutoReject(input);

      expect(result.autoReject).toBe(true);
      expect(result.reason).toContain("minimal");
    });

    it("should pass if cuti with sufficient advance notice", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const input: AutoRejectInput = {
        userId: "user-1",
        tenantId: "tenant-1",
        leaveType: "CUTI",
        startDate: futureDate,
        endDate: futureDate,
        leaveDays: 1,
        hasAttachment: false,
      };

      vi.spyOn(
        service["leaveBalanceRepository"],
        "getRemainingDays",
      ).mockResolvedValue(10);
      vi.spyOn(
        service["leaveRepository"],
        "findActiveLeaveForUserOnDate",
      ).mockResolvedValue(null);

      const result = await service.shouldAutoReject(input);

      expect(result.autoReject).toBe(false);
    });
  });

  describe("Rule 7: Tukar Libur Without Replacement Date", () => {
    it("should reject if tukar libur without replacement date", async () => {
      const input: AutoRejectInput = {
        userId: "user-1",
        tenantId: "tenant-1",
        leaveType: "TUKAR_LIBUR",
        startDate: futureDate(30),
        endDate: futureDate(30),
        leaveDays: 1,
        hasAttachment: false,
      };

      vi.spyOn(
        service["leaveRepository"],
        "findActiveLeaveForUserOnDate",
      ).mockResolvedValue(null);

      const result = await service.shouldAutoReject(input);

      expect(result.autoReject).toBe(true);
      expect(result.reason).toContain("tanggal pengganti");
    });

    it("should pass if tukar libur with replacement date", async () => {
      const input: AutoRejectInput = {
        userId: "user-1",
        tenantId: "tenant-1",
        leaveType: "TUKAR_LIBUR",
        startDate: futureDate(30),
        endDate: futureDate(30),
        leaveDays: 1,
        hasAttachment: false,
        replacementDate: futureDate(44),
      };

      vi.spyOn(
        service["leaveRepository"],
        "findActiveLeaveForUserOnDate",
      ).mockResolvedValue(null);

      const result = await service.shouldAutoReject(input);

      expect(result.autoReject).toBe(false);
    });
  });

  describe("Admin Created Leaves", () => {
    it("should bypass backdate check for admin-created leaves", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const input: AutoRejectInput = {
        userId: "user-1",
        tenantId: "tenant-1",
        leaveType: "CUTI",
        startDate: yesterday,
        endDate: yesterday,
        leaveDays: 1,
        hasAttachment: false,
        isAdminCreated: true,
      };

      vi.spyOn(
        service["leaveBalanceRepository"],
        "getRemainingDays",
      ).mockResolvedValue(10);
      vi.spyOn(
        service["leaveRepository"],
        "findActiveLeaveForUserOnDate",
      ).mockResolvedValue(null);

      const result = await service.shouldAutoReject(input);

      expect(result.autoReject).toBe(false);
    });
  });
});
