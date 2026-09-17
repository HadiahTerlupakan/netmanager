import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IMitraWalletRepository } from "@/modules/mitra/domain/ports/IMitraWalletRepository";
import type {
  MitraTransactionEntity,
  MitraWalletEntity,
  WalletSummaryEntity,
} from "@/modules/mitra/domain/entities/MitraWalletEntity";
import { MitraWalletService } from "@/modules/mitra/services/MitraWalletService";

const wallet: MitraWalletEntity = {
  id: "wallet-1",
  mitraId: "mitra-1",
  balance: 500000,
  totalEarnings: 1000000,
  totalWithdrawn: 500000,
};
const summary: WalletSummaryEntity = {
  balance: 500000,
  totalEarnings: 1000000,
  totalWithdrawn: 500000,
  earningsThisMonth: 200000,
  earningsCount: 5,
};
const transaction: MitraTransactionEntity = {
  id: "tx-1",
  walletId: "wallet-1",
  type: "EARNING",
  amount: 100000,
  description: "WO Commission",
  referenceId: "wo-1",
  referenceType: "WORK_ORDER",
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
};

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
    countMonthlyEarningsByDescription: vi.fn(),
  };
}

describe("MitraWalletService", () => {
  let repository: IMitraWalletRepository;
  let service: MitraWalletService;

  beforeEach(() => {
    repository = createMockRepository();
    service = new MitraWalletService(repository);
  });

  describe("getBalance", () => {
    it("returns wallet balance for eligible mitra", async () => {
      vi.mocked(repository.findWalletByUserId).mockResolvedValue(wallet);

      const result = await service.getBalance("mitra-1", "tenant-1");

      expect(result.success).toBe(true);
      expect(repository.findWalletByUserId).toHaveBeenCalledWith(
        "mitra-1",
        "tenant-1",
      );
      expect(result.data).toEqual({
        balance: 500000,
        totalEarnings: 1000000,
        totalWithdrawn: 500000,
      });
    });

    it("creates wallet automatically for eligible mitra type", async () => {
      vi.mocked(repository.findWalletByUserId).mockResolvedValue(null);
      vi.mocked(repository.findMitraTypeById).mockResolvedValue({
        mitraType: "MITRA_TEKNISI",
      });
      vi.mocked(repository.createWallet).mockResolvedValue({
        ...wallet,
        id: "wallet-new",
        balance: 0,
        totalEarnings: 0,
        totalWithdrawn: 0,
      });

      const result = await service.getBalance("mitra-1");

      expect(result.success).toBe(true);
      expect(repository.createWallet).toHaveBeenCalledWith("mitra-1");
    });

    it("returns error for non-mitra user", async () => {
      vi.mocked(repository.findWalletByUserId).mockResolvedValue(null);
      vi.mocked(repository.findMitraTypeById).mockResolvedValue(null);

      const result = await service.getBalance("user-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("User bukan mitra");
      expect(repository.createWallet).not.toHaveBeenCalled();
    });

    it("returns failure when repository throws", async () => {
      vi.mocked(repository.findWalletByUserId).mockRejectedValue(
        new Error("database down"),
      );

      const result = await service.getBalance("mitra-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Gagal mengambil saldo");
    });
  });

  describe("addEarning", () => {
    it("adds earning successfully", async () => {
      vi.mocked(repository.addEarning).mockResolvedValue(undefined);

      const result = await service.addEarning(
        "mitra-1",
        100000,
        "WO Commission",
        "wo-1",
        "WORK_ORDER",
      );

      expect(result.success).toBe(true);
      expect(repository.addEarning).toHaveBeenCalledWith({
        userId: "mitra-1",
        amount: 100000,
        description: "WO Commission",
        referenceId: "wo-1",
        referenceType: "WORK_ORDER",
      });
    });

    it("rejects negative amount", async () => {
      const result = await service.addEarning("mitra-1", -100, "Invalid");

      expect(result.success).toBe(false);
      expect(repository.addEarning).not.toHaveBeenCalled();
    });

    it("rejects zero amount", async () => {
      const result = await service.addEarning("mitra-1", 0, "Invalid");

      expect(result.success).toBe(false);
      expect(repository.addEarning).not.toHaveBeenCalled();
    });

    it("returns repository error message", async () => {
      vi.mocked(repository.addEarning).mockRejectedValue(
        new Error("wallet not found"),
      );

      const result = await service.addEarning("mitra-1", 100000, "Bonus");

      expect(result.success).toBe(false);
      expect(result.error).toBe("wallet not found");
    });
  });

  describe("deductBalance", () => {
    it("deducts balance successfully", async () => {
      vi.mocked(repository.deductBalance).mockResolvedValue(undefined);

      const result = await service.deductBalance("mitra-1", 50000, "Penalty");

      expect(result.success).toBe(true);
      expect(repository.deductBalance).toHaveBeenCalledWith({
        userId: "mitra-1",
        amount: 50000,
        description: "Penalty",
        referenceId: undefined,
        referenceType: undefined,
      });
    });

    it("rejects negative amount", async () => {
      const result = await service.deductBalance("mitra-1", -50, "Invalid");

      expect(result.success).toBe(false);
      expect(repository.deductBalance).not.toHaveBeenCalled();
    });

    it("returns repository error message", async () => {
      vi.mocked(repository.deductBalance).mockRejectedValue(
        new Error("insufficient balance"),
      );

      const result = await service.deductBalance("mitra-1", 50000, "Penalty");

      expect(result.success).toBe(false);
      expect(result.error).toBe("insufficient balance");
    });
  });

  describe("addAdjustment", () => {
    it("adds adjustment successfully", async () => {
      vi.mocked(repository.addAdjustment).mockResolvedValue(undefined);

      const result = await service.addAdjustment(
        "mitra-1",
        100000,
        "Bonus",
        "admin-1",
        "tenant-1",
      );

      expect(result.success).toBe(true);
      expect(repository.addAdjustment).toHaveBeenCalledWith({
        userId: "mitra-1",
        amount: 100000,
        description: "Bonus",
        tenantId: "tenant-1",
      });
    });

    it("rejects zero amount", async () => {
      const result = await service.addAdjustment(
        "mitra-1",
        0,
        "Zero",
        "admin-1",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Jumlah penyesuaian tidak valid");
      expect(repository.addAdjustment).not.toHaveBeenCalled();
    });

    it("rejects infinite amount", async () => {
      const result = await service.addAdjustment(
        "mitra-1",
        Infinity,
        "Inf",
        "admin-1",
      );

      expect(result.success).toBe(false);
      expect(repository.addAdjustment).not.toHaveBeenCalled();
    });

    it("returns repository error message", async () => {
      vi.mocked(repository.addAdjustment).mockRejectedValue(
        new Error("adjustment rejected"),
      );

      const result = await service.addAdjustment(
        "mitra-1",
        100000,
        "Bonus",
        "admin-1",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("adjustment rejected");
    });
  });

  describe("getTransactions", () => {
    it("returns paginated transactions", async () => {
      vi.mocked(repository.getTransactionsByUserId).mockResolvedValue({
        transactions: [transaction],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const result = await service.getTransactions(
        "mitra-1",
        "tenant-1",
        1,
        20,
      );

      expect(result.success).toBe(true);
      expect(repository.getTransactionsByUserId).toHaveBeenCalledWith(
        "mitra-1",
        "tenant-1",
        1,
        20,
      );
      expect(result.data?.transactions).toHaveLength(1);
    });

    it("returns empty result when no transactions", async () => {
      vi.mocked(repository.getTransactionsByUserId).mockResolvedValue(null);

      const result = await service.getTransactions("mitra-1");

      expect(result.success).toBe(true);
      expect(result.data?.transactions).toEqual([]);
      expect(result.data?.total).toBe(0);
    });

    it("returns failure when repository throws", async () => {
      vi.mocked(repository.getTransactionsByUserId).mockRejectedValue(
        new Error("query failed"),
      );

      const result = await service.getTransactions("mitra-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Gagal mengambil riwayat transaksi");
    });
  });

  describe("getEarningsSummary", () => {
    it("returns earnings summary for period", async () => {
      vi.mocked(repository.getEarningsSummaryByUserId).mockResolvedValue(
        summary,
      );

      const result = await service.getEarningsSummary(
        "mitra-1",
        "tenant-1",
        6,
        2026,
      );

      expect(result.success).toBe(true);
      expect(repository.getEarningsSummaryByUserId).toHaveBeenCalledWith({
        userId: "mitra-1",
        tenantId: "tenant-1",
        startDate: new Date(2026, 5, 1),
        endDate: new Date(2026, 6, 0, 23, 59, 59),
      });
      expect(result.data?.earningsThisMonth).toBe(200000);
    });

    it("returns empty summary when no data", async () => {
      vi.mocked(repository.getEarningsSummaryByUserId).mockResolvedValue(null);

      const result = await service.getEarningsSummary("mitra-1");

      expect(result.success).toBe(true);
      expect(result.data?.balance).toBe(0);
      expect(result.data?.earningsCount).toBe(0);
    });

    it("returns failure when repository throws", async () => {
      vi.mocked(repository.getEarningsSummaryByUserId).mockRejectedValue(
        new Error("summary failed"),
      );

      const result = await service.getEarningsSummary("mitra-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Gagal mengambil ringkasan pendapatan");
    });
  });

  describe("countMonthlyEarningsByDescription", () => {
    it("returns count of monthly earnings", async () => {
      const startDate = new Date("2026-06-01T00:00:00.000Z");
      vi.mocked(repository.countMonthlyEarningsByDescription).mockResolvedValue(
        3,
      );

      const result = await service.countMonthlyEarningsByDescription(
        "mitra-1",
        "PSB",
        startDate,
      );

      expect(result.success).toBe(true);
      expect(repository.countMonthlyEarningsByDescription).toHaveBeenCalledWith(
        { mitraId: "mitra-1", keyword: "PSB", startDate },
      );
      expect(result.data).toBe(3);
    });

    it("returns failure when repository throws", async () => {
      vi.mocked(repository.countMonthlyEarningsByDescription).mockRejectedValue(
        new Error("count failed"),
      );

      const result = await service.countMonthlyEarningsByDescription(
        "mitra-1",
        "PSB",
        new Date("2026-06-01T00:00:00.000Z"),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Gagal menghitung transaksi bulanan");
    });
  });
});
