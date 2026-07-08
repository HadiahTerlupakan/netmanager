import { beforeEach, describe, expect, it, vi } from "vitest";
import { MitraWithdrawService } from "@/modules/mitra/services/MitraWithdrawService";
import type { IMitraWithdrawRepository } from "@/modules/mitra/domain/ports/IMitraWithdrawRepository";
import type { AttendanceSettingsService } from "@/modules/attendance";

vi.mock("@/lib/event-bus", () => ({
  EVENT_NAMES: {
    MITRA_WITHDRAWAL_COMPLETED: "mitra.withdrawal.completed",
  },
  eventBus: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

function createMockRepository(): IMitraWithdrawRepository {
  return {
    findMitraById: vi.fn(),
    findWalletByMitraId: vi.fn(),
    countPendingWithdrawals: vi.fn(),
    createWithdrawRequest: vi.fn(),
    createWithdrawRequestAtomic: vi.fn(),
    findWithdrawRequestById: vi.fn(),
    findWithdrawRequestByIdSimple: vi.fn(),
    isWithdrawInScope: vi.fn(),
    updateWithdrawStatus: vi.fn(),
    findWithdrawRequests: vi.fn(),
    completeWithdraw: vi.fn(),
    getMobileWithdrawHistory: vi.fn(),
  };
}

function createMockAttendanceSettingsService() {
  return {
    getSettings: vi.fn().mockResolvedValue({ minWithdraw: 50000 }),
  } as unknown as AttendanceSettingsService;
}

describe("MitraWithdrawService", () => {
  let repository: IMitraWithdrawRepository;
  let attendanceService: AttendanceSettingsService;
  let service: MitraWithdrawService;

  beforeEach(() => {
    repository = createMockRepository();
    attendanceService = createMockAttendanceSettingsService();
    service = new MitraWithdrawService(repository, attendanceService);
    vi.clearAllMocks();
  });

  describe("requestWithdraw", () => {
    it("creates withdraw request successfully", async () => {
      vi.mocked(repository.findMitraById).mockResolvedValue({
        id: "mitra-1",
        minWithdrawal: 50000,
        isActive: true,
      });
      vi.mocked(repository.findWalletByMitraId).mockResolvedValue({
        id: "wallet-1",
        balance: 500000,
      });
      vi.mocked(repository.createWithdrawRequestAtomic).mockResolvedValue({
        success: true,
      });

      const result = await service.requestWithdraw("mitra-1", {
        amount: 100000,
        method: "TRANSFER",
        bankName: "BCA",
        accountNumber: "1234567890",
        accountName: "Test",
      });

      expect(result.success).toBe(true);
      expect(result.data?.id).toBeDefined();
      expect(repository.createWithdrawRequestAtomic).toHaveBeenCalledWith({
        id: result.data?.id,
        userId: "mitra-1",
        walletId: "wallet-1",
        payload: {
          amount: 100000,
          method: "TRANSFER",
          bankName: "BCA",
          accountNumber: "1234567890",
          accountName: "Test",
        },
      });
    });

    it("rejects request for missing mitra", async () => {
      vi.mocked(repository.findMitraById).mockResolvedValue(null);

      const result = await service.requestWithdraw("mitra-1", {
        amount: 100000,
        method: "TRANSFER",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Mitra tidak ditemukan");
    });

    it("rejects request for inactive mitra", async () => {
      vi.mocked(repository.findMitraById).mockResolvedValue({
        id: "mitra-1",
        minWithdrawal: 50000,
        isActive: false,
      });

      const result = await service.requestWithdraw("mitra-1", {
        amount: 100000,
        method: "TRANSFER",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Akun Mitra tidak aktif");
    });

    it("rejects request below minimum", async () => {
      vi.mocked(repository.findMitraById).mockResolvedValue({
        id: "mitra-1",
        minWithdrawal: 100000,
        isActive: true,
      });

      const result = await service.requestWithdraw("mitra-1", {
        amount: 50000,
        method: "TRANSFER",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Minimum");
      expect(repository.findWalletByMitraId).not.toHaveBeenCalled();
    });

    it("rejects transfer without complete bank details", async () => {
      vi.mocked(repository.findMitraById).mockResolvedValue({
        id: "mitra-1",
        minWithdrawal: 50000,
        isActive: true,
      });

      const result = await service.requestWithdraw("mitra-1", {
        amount: 100000,
        method: "TRANSFER",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Informasi bank harus diisi untuk metode transfer",
      );
      expect(repository.findWalletByMitraId).not.toHaveBeenCalled();
    });

    it("rejects request when wallet is missing", async () => {
      vi.mocked(repository.findMitraById).mockResolvedValue({
        id: "mitra-1",
        minWithdrawal: 50000,
        isActive: true,
      });
      vi.mocked(repository.findWalletByMitraId).mockResolvedValue(null);

      const result = await service.requestWithdraw("mitra-1", {
        amount: 100000,
        method: "CASH",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Wallet tidak ditemukan");
    });

    it("handles insufficient balance", async () => {
      vi.mocked(repository.findMitraById).mockResolvedValue({
        id: "mitra-1",
        minWithdrawal: 50000,
        isActive: true,
      });
      vi.mocked(repository.findWalletByMitraId).mockResolvedValue({
        id: "wallet-1",
        balance: 10000,
      });
      vi.mocked(repository.createWithdrawRequestAtomic).mockResolvedValue({
        success: false,
        reason: "INSUFFICIENT_BALANCE",
      });

      const result = await service.requestWithdraw("mitra-1", {
        amount: 100000,
        method: "CASH",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Saldo tidak cukup");
    });

    it("handles pending request conflict", async () => {
      vi.mocked(repository.findMitraById).mockResolvedValue({
        id: "mitra-1",
        minWithdrawal: 50000,
        isActive: true,
      });
      vi.mocked(repository.findWalletByMitraId).mockResolvedValue({
        id: "wallet-1",
        balance: 500000,
      });
      vi.mocked(repository.createWithdrawRequestAtomic).mockResolvedValue({
        success: false,
        reason: "PENDING_EXISTS",
      });

      const result = await service.requestWithdraw("mitra-1", {
        amount: 100000,
        method: "CASH",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Masih ada request penarikan yang belum selesai",
      );
    });
  });

  describe("approveWithdraw", () => {
    it("approves pending request", async () => {
      vi.mocked(repository.findWithdrawRequestById).mockResolvedValue({
        id: "withdraw-1",
        status: "PENDING",
        amount: 100000,
        mitraWallet: { balance: 500000 },
      } as never);
      vi.mocked(repository.updateWithdrawStatus).mockResolvedValue(undefined);

      const result = await service.approveWithdraw("withdraw-1", "admin-1");

      expect(result.success).toBe(true);
      expect(repository.updateWithdrawStatus).toHaveBeenCalledWith({
        id: "withdraw-1",
        status: "APPROVED",
        processedById: "admin-1",
        processedAt: expect.any(Date),
      });
    });

    it("rejects approval for missing request", async () => {
      vi.mocked(repository.findWithdrawRequestById).mockResolvedValue(null);

      const result = await service.approveWithdraw("withdraw-1", "admin-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request tidak ditemukan");
      expect(repository.updateWithdrawStatus).not.toHaveBeenCalled();
    });

    it("rejects approval for non-pending request", async () => {
      vi.mocked(repository.findWithdrawRequestById).mockResolvedValue({
        id: "withdraw-1",
        status: "APPROVED",
        amount: 100000,
      } as never);

      const result = await service.approveWithdraw("withdraw-1", "admin-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request sudah diproses");
    });
  });

  describe("rejectWithdraw", () => {
    it("rejects pending request with reason", async () => {
      vi.mocked(repository.findWithdrawRequestByIdSimple).mockResolvedValue({
        id: "withdraw-1",
        status: "PENDING",
        amount: 100000,
      } as never);
      vi.mocked(repository.updateWithdrawStatus).mockResolvedValue(undefined);

      const result = await service.rejectWithdraw(
        "withdraw-1",
        "Tidak memenuhi syarat",
        "admin-1",
      );

      expect(result.success).toBe(true);
      expect(repository.updateWithdrawStatus).toHaveBeenCalledWith({
        id: "withdraw-1",
        status: "REJECTED",
        processedById: "admin-1",
        processedAt: expect.any(Date),
        rejectionReason: "Tidak memenuhi syarat",
      });
    });

    it("rejects missing request", async () => {
      vi.mocked(repository.findWithdrawRequestByIdSimple).mockResolvedValue(
        null,
      );

      const result = await service.rejectWithdraw(
        "withdraw-1",
        "Tidak memenuhi syarat",
        "admin-1",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request tidak ditemukan");
    });

    it("rejects non-pending request", async () => {
      vi.mocked(repository.findWithdrawRequestByIdSimple).mockResolvedValue({
        id: "withdraw-1",
        status: "REJECTED",
        amount: 100000,
      } as never);

      const result = await service.rejectWithdraw(
        "withdraw-1",
        "Tidak memenuhi syarat",
        "admin-1",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request sudah diproses");
    });
  });

  describe("completeWithdraw", () => {
    it("completes approved request", async () => {
      vi.mocked(repository.findWithdrawRequestById).mockResolvedValue({
        id: "withdraw-1",
        status: "APPROVED",
        amount: 100000,
        mitraId: "mitra-1",
        mitraWalletId: "wallet-1",
        mitraWallet: { balance: 500000 },
        method: "TRANSFER",
      } as never);
      vi.mocked(repository.completeWithdraw).mockResolvedValue(undefined);

      const result = await service.completeWithdraw("withdraw-1", "admin-1");

      expect(result.success).toBe(true);
      expect(repository.completeWithdraw).toHaveBeenCalledWith({
        walletId: "wallet-1",
        amount: 100000,
        requestId: "withdraw-1",
        method: "TRANSFER",
        processedById: "admin-1",
      });
    });

    it("rejects completion for missing request", async () => {
      vi.mocked(repository.findWithdrawRequestById).mockResolvedValue(null);

      const result = await service.completeWithdraw("withdraw-1", "admin-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request tidak ditemukan");
      expect(repository.completeWithdraw).not.toHaveBeenCalled();
    });

    it("rejects completion for non-approved request", async () => {
      vi.mocked(repository.findWithdrawRequestById).mockResolvedValue({
        id: "withdraw-1",
        status: "PENDING",
        amount: 100000,
      } as never);

      const result = await service.completeWithdraw("withdraw-1", "admin-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request belum disetujui");
    });
  });

  describe("processWithdrawAction", () => {
    it("delegates approve action", async () => {
      vi.mocked(repository.findWithdrawRequestById).mockResolvedValue({
        id: "withdraw-1",
        status: "PENDING",
        amount: 100000,
        mitraWallet: { balance: 500000 },
      } as never);
      vi.mocked(repository.updateWithdrawStatus).mockResolvedValue(undefined);

      const result = await service.processWithdrawAction(
        "withdraw-1",
        "approve",
        "admin-1",
      );

      expect(result.success).toBe(true);
    });

    it("delegates reject action with reason", async () => {
      vi.mocked(repository.findWithdrawRequestByIdSimple).mockResolvedValue({
        id: "withdraw-1",
        status: "PENDING",
        amount: 100000,
      } as never);
      vi.mocked(repository.updateWithdrawStatus).mockResolvedValue(undefined);

      const result = await service.processWithdrawAction(
        "withdraw-1",
        "reject",
        "admin-1",
        undefined,
        "Reason",
      );

      expect(result.success).toBe(true);
      expect(repository.updateWithdrawStatus).toHaveBeenCalledWith(
        expect.objectContaining({ rejectionReason: "Reason" }),
      );
    });

    it("uses default reject reason", async () => {
      vi.mocked(repository.findWithdrawRequestByIdSimple).mockResolvedValue({
        id: "withdraw-1",
        status: "PENDING",
        amount: 100000,
      } as never);
      vi.mocked(repository.updateWithdrawStatus).mockResolvedValue(undefined);

      const result = await service.processWithdrawAction(
        "withdraw-1",
        "reject",
        "admin-1",
      );

      expect(result.success).toBe(true);
      expect(repository.updateWithdrawStatus).toHaveBeenCalledWith(
        expect.objectContaining({ rejectionReason: "Ditolak oleh admin" }),
      );
    });

    it("delegates complete action", async () => {
      vi.mocked(repository.findWithdrawRequestById).mockResolvedValue({
        id: "withdraw-1",
        status: "APPROVED",
        amount: 100000,
        mitraId: "mitra-1",
        mitraWalletId: "wallet-1",
        mitraWallet: { balance: 500000 },
        method: "TRANSFER",
      } as never);
      vi.mocked(repository.completeWithdraw).mockResolvedValue(undefined);

      const result = await service.processWithdrawAction(
        "withdraw-1",
        "complete",
        "admin-1",
      );

      expect(result.success).toBe(true);
    });

    it("rejects invalid action", async () => {
      const result = await service.processWithdrawAction(
        "withdraw-1",
        "invalid" as never,
        "admin-1",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid action");
    });
  });

  describe("getWithdrawRequests", () => {
    it("returns paginated withdraw requests", async () => {
      vi.mocked(repository.findWithdrawRequests).mockResolvedValue({
        requests: [{ id: "withdraw-1", status: "PENDING" }],
        total: 1,
      } as never);

      const result = await service.getWithdrawRequests({ page: 1, limit: 20 });

      expect(result.success).toBe(true);
      expect(result.data?.requests).toHaveLength(1);
      expect(repository.findWithdrawRequests).toHaveBeenCalledWith({
        userId: undefined,
        status: undefined,
        page: 1,
        limit: 20,
        tenantId: undefined,
        allowedSiteIds: undefined,
      });
    });

    it("uses default pagination", async () => {
      vi.mocked(repository.findWithdrawRequests).mockResolvedValue({
        requests: [],
        total: 0,
      } as never);

      const result = await service.getWithdrawRequests({});

      expect(result.success).toBe(true);
      expect(repository.findWithdrawRequests).toHaveBeenCalledWith({
        userId: undefined,
        status: undefined,
        page: 1,
        limit: 20,
        tenantId: undefined,
        allowedSiteIds: undefined,
      });
    });

    it("returns error when repository fails", async () => {
      vi.mocked(repository.findWithdrawRequests).mockRejectedValue(
        new Error("db down"),
      );

      const result = await service.getWithdrawRequests({ page: 1, limit: 20 });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Gagal mengambil data penarikan");
    });
  });

  describe("getMinWithdrawSetting", () => {
    it("returns minimum withdraw setting", async () => {
      const result = await service.getMinWithdrawSetting();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ minWithdraw: 50000 });
    });
  });

  describe("isWithdrawInScope", () => {
    it("checks withdraw scope", async () => {
      vi.mocked(repository.isWithdrawInScope).mockResolvedValue(true);

      const result = await service.isWithdrawInScope("withdraw-1", ["site-1"]);

      expect(result).toBe(true);
      expect(repository.isWithdrawInScope).toHaveBeenCalledWith(
        "withdraw-1",
        ["site-1"],
        undefined,
      );
    });
  });
});
