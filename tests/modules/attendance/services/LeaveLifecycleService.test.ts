import { describe, it, expect, beforeEach, vi } from "vitest";
import { LeaveLifecycleService } from "@/modules/attendance/services/LeaveLifecycleService";
import type { ILeaveRepository } from "@/modules/attendance/domain/ports/ILeaveRepository";
import type { IHolidayRepository } from "@/modules/attendance/domain/ports/IHolidayRepository";
import type { LeaveRepository } from "@/modules/attendance/repositories/LeaveRepository";
import type { HolidayRepository } from "@/modules/attendance/repositories/HolidayRepository";
import type { UserLookupService } from "@/modules/users";
import type { LeaveAttendanceSyncService } from "@/modules/attendance/services/LeaveAttendanceSyncService";
import type { LeaveBalanceUsageService } from "@/modules/attendance/services/LeaveBalanceUsageService";
import type { LeaveNotificationService } from "@/modules/attendance/services/LeaveNotificationService";
import type { CreateLeaveData } from "@/modules/attendance/services/LeaveService";
import type { LeaveWithUserEntity } from "@/modules/attendance/domain/ports/ILeaveRepository";

// Mock helper modules
vi.mock("@/modules/attendance/services/leave-lifecycle.helpers", () => ({
  buildCreateBalanceInput: vi.fn(() => ({
    userId: "user-1",
    tenantId: "tenant-1",
    type: "CUTI",
    startDate: new Date("2026-05-10"),
    endDate: new Date("2026-05-12"),
  })),
  buildExistingBalanceInput: vi.fn(() => ({
    userId: "user-1",
    tenantId: "tenant-1",
    type: "CUTI",
    startDate: new Date("2026-05-10"),
    endDate: new Date("2026-05-12"),
  })),
  emptyBalanceInput: vi.fn(() => ({
    userId: "user-1",
    tenantId: "tenant-1",
    type: "CUTI",
    startDate: new Date("2026-05-10"),
    endDate: new Date("2026-05-12"),
  })),
  insufficientBalanceResult: vi.fn(() => ({
    success: false,
    error: "Saldo cuti tidak mencukupi",
    code: "INSUFFICIENT_BALANCE",
  })),
  createDecisionDetails: vi.fn((data) => data),
  logLeaveMutation: vi.fn(),
  notifyLeaveDecision: vi.fn(),
  revertApprovedLeave: vi.fn(),
  syncApprovedLeave: vi.fn(),
  syncAutoApprovedLeave: vi.fn(),
}));

vi.mock("@/modules/attendance/services/leave-lifecycle-error.helpers", () => ({
  createLeaveFailureResult: vi.fn((error, code) => ({
    success: false,
    error,
    code,
  })),
  handleDeleteLeaveError: vi.fn((error) => ({
    success: false,
    error: error instanceof Error ? error.message : "Gagal menghapus cuti",
    code: "DELETE_ERROR",
  })),
  handleLeaveError: vi.fn((_context, error, fallback, code) => ({
    success: false,
    error: error instanceof Error ? error.message : fallback,
    code,
  })),
}));

vi.mock(
  "@/modules/attendance/services/LeaveTukarLiburValidationService",
  () => ({
    validateTukarLiburCreateRequest: vi.fn(() =>
      Promise.resolve({ success: true }),
    ),
  }),
);

describe("LeaveLifecycleService", () => {
  let service: LeaveLifecycleService;
  let mockLeaveRepository: ILeaveRepository & LeaveRepository;
  let mockHolidayRepository: IHolidayRepository & HolidayRepository;
  let mockUserRepository: UserLookupService;
  let mockAttendanceSyncService: LeaveAttendanceSyncService;
  let mockBalanceUsageService: LeaveBalanceUsageService;
  let mockNotificationService: LeaveNotificationService;

  const mockLeaveWithUser: LeaveWithUserEntity = {
    id: "leave-1",
    userId: "user-1",
    type: "CUTI",
    startDate: new Date("2026-05-10"),
    endDate: new Date("2026-05-12"),
    reason: "Liburan keluarga",
    status: "PENDING",
    approvedBy: null,
    rejectionReason: null,
    replacementDate: null,
    attachmentUrl: null,
    tenantId: "tenant-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
    },
  } as LeaveWithUserEntity;

  const mockCreateLeaveData: CreateLeaveData = {
    userId: "user-1",
    type: "CUTI",
    startDate: new Date("2026-05-10"),
    endDate: new Date("2026-05-12"),
    reason: "Liburan keluarga",
  };

  beforeEach(() => {
    // Mock repositories
    mockLeaveRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByIdWithUser: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
    } as unknown as ILeaveRepository & LeaveRepository;

    mockHolidayRepository = {
      isHoliday: vi.fn(),
    } as unknown as IHolidayRepository & HolidayRepository;

    mockUserRepository = {
      findWorkScheduleByIdWithTenant: vi.fn(),
    } as unknown as UserLookupService;

    mockAttendanceSyncService = {
      syncLeaveToAttendance: vi.fn(),
      removeLeaveAttendance: vi.fn(),
    } as unknown as LeaveAttendanceSyncService;

    mockBalanceUsageService = {
      calculateLeaveDays: vi.fn(),
      hasEnoughDays: vi.fn(),
      incrementUsed: vi.fn(),
      decrementUsed: vi.fn(),
    } as unknown as LeaveBalanceUsageService;

    mockNotificationService = {
      logActivity: vi.fn(),
      notifyUser: vi.fn(),
    } as unknown as LeaveNotificationService;

    service = new LeaveLifecycleService(
      mockLeaveRepository,
      mockHolidayRepository,
      mockUserRepository,
      mockAttendanceSyncService,
      mockBalanceUsageService,
      mockNotificationService,
    );
  });

  describe("createLeave", () => {
    it("harus membuat leave dengan status PENDING jika autoApprove false", async () => {
      const mockUser = {
        workDays: "1,2,3,4,5",
        workingHourMode: "FIXED" as const,
      };

      vi.mocked(
        mockUserRepository.findWorkScheduleByIdWithTenant,
      ).mockResolvedValue(mockUser);
      vi.mocked(mockBalanceUsageService.calculateLeaveDays).mockResolvedValue(
        3,
      );
      vi.mocked(mockBalanceUsageService.hasEnoughDays).mockResolvedValue(true);
      vi.mocked(mockLeaveRepository.create).mockResolvedValue({
        ...mockLeaveWithUser,
        status: "PENDING",
      });

      const result = await service.createLeave(
        mockCreateLeaveData,
        "creator-1",
        "tenant-1",
        false,
      );

      expect(result.success).toBe(true);
      expect(mockLeaveRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          type: "CUTI",
          status: "PENDING",
          approvedBy: null,
        }),
      );
    });

    it("harus membuat leave dengan status APPROVED jika autoApprove true", async () => {
      const mockUser = {
        workDays: "1,2,3,4,5",
        workingHourMode: "FIXED" as const,
      };

      vi.mocked(
        mockUserRepository.findWorkScheduleByIdWithTenant,
      ).mockResolvedValue(mockUser);
      vi.mocked(mockBalanceUsageService.calculateLeaveDays).mockResolvedValue(
        3,
      );
      vi.mocked(mockBalanceUsageService.hasEnoughDays).mockResolvedValue(true);
      vi.mocked(mockLeaveRepository.create).mockResolvedValue({
        ...mockLeaveWithUser,
        status: "APPROVED",
        approvedBy: "creator-1",
      });

      const result = await service.createLeave(
        mockCreateLeaveData,
        "creator-1",
        "tenant-1",
        true,
      );

      expect(result.success).toBe(true);
      expect(mockLeaveRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "APPROVED",
          approvedBy: "creator-1",
        }),
      );
    });

    it("harus return error jika saldo tidak mencukupi", async () => {
      const mockUser = {
        workDays: "1,2,3,4,5",
        workingHourMode: "FIXED" as const,
      };

      vi.mocked(
        mockUserRepository.findWorkScheduleByIdWithTenant,
      ).mockResolvedValue(mockUser);
      vi.mocked(mockBalanceUsageService.calculateLeaveDays).mockResolvedValue(
        3,
      );
      vi.mocked(mockBalanceUsageService.hasEnoughDays).mockResolvedValue(false);

      const result = await service.createLeave(
        mockCreateLeaveData,
        "creator-1",
        "tenant-1",
        false,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Saldo cuti tidak mencukupi");
      expect(result.code).toBe("INSUFFICIENT_BALANCE");
      expect(mockLeaveRepository.create).not.toHaveBeenCalled();
    });

    it("harus handle error saat create gagal", async () => {
      vi.mocked(
        mockUserRepository.findWorkScheduleByIdWithTenant,
      ).mockRejectedValue(new Error("Database error"));

      const result = await service.createLeave(
        mockCreateLeaveData,
        "creator-1",
        "tenant-1",
        false,
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("CREATE_ERROR");
    });
  });

  describe("approveLeave", () => {
    it("harus approve leave yang PENDING", async () => {
      vi.mocked(mockLeaveRepository.findByIdWithUser).mockResolvedValue(
        mockLeaveWithUser,
      );
      vi.mocked(mockBalanceUsageService.calculateLeaveDays).mockResolvedValue(
        3,
      );
      vi.mocked(mockBalanceUsageService.hasEnoughDays).mockResolvedValue(true);
      vi.mocked(mockLeaveRepository.update).mockResolvedValue({
        ...mockLeaveWithUser,
        status: "APPROVED",
        approvedBy: "approver-1",
      });

      const result = await service.approveLeave(
        "leave-1",
        "approver-1",
        "tenant-1",
      );

      expect(result.success).toBe(true);
      expect(mockLeaveRepository.update).toHaveBeenCalledWith("leave-1", {
        status: "APPROVED",
        approvedBy: "approver-1",
      });
      expect(mockBalanceUsageService.incrementUsed).toHaveBeenCalled();
    });

    it("harus return error jika leave tidak ditemukan", async () => {
      vi.mocked(mockLeaveRepository.findByIdWithUser).mockResolvedValue(null);

      const result = await service.approveLeave(
        "leave-999",
        "approver-1",
        "tenant-1",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cuti tidak ditemukan");
      expect(result.code).toBe("NOT_FOUND");
    });

    it("harus return error jika leave sudah APPROVED", async () => {
      vi.mocked(mockLeaveRepository.findByIdWithUser).mockResolvedValue({
        ...mockLeaveWithUser,
        status: "APPROVED",
      });

      const result = await service.approveLeave(
        "leave-1",
        "approver-1",
        "tenant-1",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cuti sudah disetujui");
      expect(result.code).toBe("ALREADY_APPROVED");
    });

    it("harus return error jika saldo tidak mencukupi saat approve", async () => {
      vi.mocked(mockLeaveRepository.findByIdWithUser).mockResolvedValue(
        mockLeaveWithUser,
      );
      vi.mocked(mockBalanceUsageService.calculateLeaveDays).mockResolvedValue(
        3,
      );
      vi.mocked(mockBalanceUsageService.hasEnoughDays).mockResolvedValue(false);

      const result = await service.approveLeave(
        "leave-1",
        "approver-1",
        "tenant-1",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Saldo cuti tidak mencukupi");
      expect(mockLeaveRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("rejectLeave", () => {
    it("harus reject leave yang PENDING", async () => {
      vi.mocked(mockLeaveRepository.findByIdWithUser).mockResolvedValue(
        mockLeaveWithUser,
      );
      vi.mocked(mockLeaveRepository.update).mockResolvedValue({
        ...mockLeaveWithUser,
        status: "REJECTED",
        rejectionReason: "Tidak ada coverage",
      });

      const result = await service.rejectLeave(
        "leave-1",
        "approver-1",
        "tenant-1",
        "Tidak ada coverage",
      );

      expect(result.success).toBe(true);
      expect(mockLeaveRepository.update).toHaveBeenCalledWith("leave-1", {
        status: "REJECTED",
        rejectionReason: "Tidak ada coverage",
      });
    });

    it("harus revert saldo jika leave sebelumnya APPROVED", async () => {
      const { revertApprovedLeave } =
        await import("@/modules/attendance/services/leave-lifecycle.helpers");

      vi.mocked(mockLeaveRepository.findByIdWithUser).mockResolvedValue({
        ...mockLeaveWithUser,
        status: "APPROVED",
      });
      vi.mocked(mockLeaveRepository.update).mockResolvedValue({
        ...mockLeaveWithUser,
        status: "REJECTED",
      });

      await service.rejectLeave(
        "leave-1",
        "approver-1",
        "tenant-1",
        "Dibatalkan",
      );

      expect(revertApprovedLeave).toHaveBeenCalledWith({
        leave: expect.objectContaining({ status: "APPROVED" }),
        tenantId: "tenant-1",
        action: "reject",
        balanceUsageService: mockBalanceUsageService,
        attendanceSyncService: mockAttendanceSyncService,
      });
    });

    it("harus return error jika leave tidak ditemukan", async () => {
      vi.mocked(mockLeaveRepository.findByIdWithUser).mockResolvedValue(null);

      const result = await service.rejectLeave(
        "leave-999",
        "approver-1",
        "tenant-1",
        "Alasan",
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("NOT_FOUND");
    });
  });

  describe("deleteLeave", () => {
    it("harus delete leave yang PENDING", async () => {
      vi.mocked(mockLeaveRepository.findByIdWithUser).mockResolvedValue(
        mockLeaveWithUser,
      );
      vi.mocked(mockLeaveRepository.delete).mockResolvedValue(undefined);

      const result = await service.deleteLeave(
        "leave-1",
        "deleter-1",
        "tenant-1",
      );

      expect(result.success).toBe(true);
      expect(mockLeaveRepository.delete).toHaveBeenCalledWith("leave-1");
    });

    it("harus revert saldo dan attendance jika leave APPROVED", async () => {
      const { revertApprovedLeave } =
        await import("@/modules/attendance/services/leave-lifecycle.helpers");

      vi.mocked(mockLeaveRepository.findByIdWithUser).mockResolvedValue({
        ...mockLeaveWithUser,
        status: "APPROVED",
      });
      vi.mocked(mockLeaveRepository.delete).mockResolvedValue(undefined);

      await service.deleteLeave("leave-1", "deleter-1", "tenant-1");

      expect(revertApprovedLeave).toHaveBeenCalledWith({
        leave: expect.objectContaining({ status: "APPROVED" }),
        tenantId: "tenant-1",
        action: "deletion",
        balanceUsageService: mockBalanceUsageService,
        attendanceSyncService: mockAttendanceSyncService,
      });
    });

    it("harus return error jika leave tidak ditemukan", async () => {
      vi.mocked(mockLeaveRepository.findByIdWithUser).mockResolvedValue(null);

      const result = await service.deleteLeave(
        "leave-999",
        "deleter-1",
        "tenant-1",
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("NOT_FOUND");
    });

    it("harus handle error saat delete gagal", async () => {
      vi.mocked(mockLeaveRepository.findByIdWithUser).mockResolvedValue(
        mockLeaveWithUser,
      );
      vi.mocked(mockLeaveRepository.delete).mockRejectedValue(
        new Error("Database error"),
      );

      const result = await service.deleteLeave(
        "leave-1",
        "deleter-1",
        "tenant-1",
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("DELETE_ERROR");
    });
  });
});
