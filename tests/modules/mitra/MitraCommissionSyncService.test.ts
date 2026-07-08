import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IMitraWalletRepository } from "@/modules/mitra/domain/ports/IMitraWalletRepository";
import { MitraCommissionSyncService } from "@/modules/mitra/services/MitraCommissionSyncService";

function createMockRepository(): IMitraWalletRepository {
  return {
    findWalletByUserId: vi.fn(),
    findMitraTypeById: vi.fn(),
    createWallet: vi.fn(),
    addEarning: vi.fn(),
    deductBalance: vi.fn(),
    addAdjustment: vi.fn(),
    getTransactionsByUserId: vi.fn(),
    getEarningsSummaryByUserId: vi.fn(),
    findTransactionByReferenceId: vi.fn(),
    countMonthlyEarningsByDescription: vi.fn(),
  };
}

describe("MitraCommissionSyncService", () => {
  let repository: IMitraWalletRepository;
  let service: MitraCommissionSyncService;

  beforeEach(() => {
    repository = createMockRepository();
    service = new MitraCommissionSyncService(repository);
  });

  describe("syncCommission", () => {
    it("syncs commission successfully", async () => {
      vi.mocked(repository.findTransactionByReferenceId).mockResolvedValue(
        null,
      );
      vi.mocked(repository.addEarning).mockResolvedValue(undefined);

      const result = await service.syncCommission({
        mitraId: "mitra-1",
        amount: 100000,
        description: "WO Commission",
        referenceId: "wo-1",
      });

      expect(result.success).toBe(true);
      expect(repository.addEarning).toHaveBeenCalledWith({
        userId: "mitra-1",
        amount: 100000,
        description: "WO Commission",
        referenceId: "wo-1",
      });
    });

    it("rejects sync with missing mitraId", async () => {
      const result = await service.syncCommission({
        mitraId: "",
        amount: 100000,
        referenceId: "wo-1",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.error).toBe("Data tidak lengkap");
    });

    it("rejects sync with missing referenceId", async () => {
      const result = await service.syncCommission({
        mitraId: "mitra-1",
        amount: 100000,
        referenceId: "",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("VALIDATION_ERROR");
    });

    it("rejects sync with zero amount", async () => {
      const result = await service.syncCommission({
        mitraId: "mitra-1",
        amount: 0,
        referenceId: "wo-1",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("VALIDATION_ERROR");
    });

    it("rejects sync with negative amount", async () => {
      const result = await service.syncCommission({
        mitraId: "mitra-1",
        amount: -100,
        referenceId: "wo-1",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("VALIDATION_ERROR");
    });

    it("returns duplicate error for existing transaction", async () => {
      vi.mocked(repository.findTransactionByReferenceId).mockResolvedValue({
        id: "tx-1",
        walletId: "wallet-1",
        type: "EARNING",
        amount: 100000,
        description: "WO Commission",
        referenceId: "wo-1",
        referenceType: null,
        createdAt: new Date("2026-07-07T00:00:00.000Z"),
      });

      const result = await service.syncCommission({
        mitraId: "mitra-1",
        amount: 100000,
        referenceId: "wo-1",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("DUPLICATE");
    });

    it("returns not found when mitra not in tenant", async () => {
      vi.mocked(repository.findMitraTypeById).mockResolvedValue(null);

      const result = await service.syncCommission({
        mitraId: "mitra-1",
        amount: 100000,
        referenceId: "wo-1",
        tenantId: "tenant-1",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("NOT_FOUND");
      expect(result.error).toBe("Mitra tidak ditemukan");
    });

    it("skips tenant check when no tenantId", async () => {
      vi.mocked(repository.findTransactionByReferenceId).mockResolvedValue(
        null,
      );
      vi.mocked(repository.addEarning).mockResolvedValue(undefined);

      const result = await service.syncCommission({
        mitraId: "mitra-1",
        amount: 100000,
        referenceId: "wo-1",
      });

      expect(result.success).toBe(true);
      expect(repository.findMitraTypeById).not.toHaveBeenCalled();
    });

    it("handles internal errors gracefully", async () => {
      vi.mocked(repository.findTransactionByReferenceId).mockRejectedValue(
        new Error("Database connection failed"),
      );

      const result = await service.syncCommission({
        mitraId: "mitra-1",
        amount: 100000,
        referenceId: "wo-1",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("INTERNAL_ERROR");
    });
  });
});
