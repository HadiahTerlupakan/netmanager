import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CycleInvoiceSyncer,
  InvoiceProrateService,
} from "@/modules/finance/services/InvoiceProrateService";
import type { IProrateRepository } from "@/modules/finance/domain/ports/IProrateRepository";

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logActivity: vi.fn(() => Promise.resolve()),
    logActivitySafe: vi.fn(),
    logAuth: vi.fn(),
    apiRequest: vi.fn(),
    dbOperation: vi.fn(),
  },
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW = new Date("2026-05-13T10:00:00Z");
const TANGGAL_AKTIF = new Date("2026-05-01T00:00:00Z");
const JATUH_TEMPO = new Date("2026-05-31T00:00:00Z");

const basePelanggan = {
  id: "pelanggan-1",
  jatuhTempo: JATUH_TEMPO,
  tanggalAktif: TANGGAL_AKTIF,
  hargaPaketId: "paket-lama",
  tenantId: "tenant-1" as string | null,
  pendingPackageId: null as string | null,
  pendingPackageApplyAt: null as Date | null,
};

const oldPackage = { id: "paket-lama", harga: 100000 };
const newPackageUpgrade = { id: "paket-baru-upgrade", harga: 200000 };
const newPackageDowngrade = { id: "paket-baru-downgrade", harga: 50000 };

const baseInput = {
  pelangganId: "pelanggan-1",
  oldHargaPaketId: "paket-lama",
  newHargaPaketId: "paket-baru-upgrade",
  prorateOption: "NONE" as const,
  downgradeAdjustment: "NONE" as const,
  upgradeApplyTime: "IMMEDIATE" as const,
  userId: "user-admin-1",
};

type MockedProrateRepo = {
  findPelangganProrateContext: ReturnType<typeof vi.fn>;
  findPackagePair: ReturnType<typeof vi.fn>;
  schedulePackageChange: ReturnType<typeof vi.fn>;
  clearPendingPackage: ReturnType<typeof vi.fn>;
  incrementSaldoKredit: ReturnType<typeof vi.fn>;
  createProrateInvoice: ReturnType<typeof vi.fn>;
  createRefundPaymentRecord: ReturnType<typeof vi.fn>;
  recordProrateLog: ReturnType<typeof vi.fn>;
};

/** Buat mock repository yang patuh shape IProrateRepository — di-cast lewat
 *  unknown supaya pemanggil test tetap bisa mengakses helper Mock dari Vitest. */
const buildMockRepo = (): MockedProrateRepo => ({
  findPelangganProrateContext: vi.fn(),
  findPackagePair: vi.fn(),
  schedulePackageChange: vi.fn().mockResolvedValue(undefined),
  clearPendingPackage: vi.fn().mockResolvedValue(undefined),
  incrementSaldoKredit: vi.fn().mockResolvedValue(undefined),
  createProrateInvoice: vi.fn(),
  createRefundPaymentRecord: vi.fn(),
  recordProrateLog: vi.fn().mockResolvedValue(undefined),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("InvoiceProrateService", () => {
  let repo: ReturnType<typeof buildMockRepo>;
  let cycleInvoice: { syncCycleInvoice: ReturnType<typeof vi.fn> };
  let service: InvoiceProrateService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
    repo = buildMockRepo();
    cycleInvoice = {
      syncCycleInvoice: vi.fn().mockResolvedValue({ status: "NOT_ISSUED" }),
    };
    service = new InvoiceProrateService(
      repo as unknown as IProrateRepository,
      cycleInvoice as unknown as CycleInvoiceSyncer,
    );

    // Default: pelanggan + pair found
    repo.findPelangganProrateContext.mockResolvedValue(basePelanggan);
    repo.findPackagePair.mockResolvedValue({
      old: oldPackage,
      new: newPackageUpgrade,
    });
  });

  describe("IMMEDIATE + NONE", () => {
    it("tidak buat invoice/credit/refund, hanya log", async () => {
      const result = await service.applyPackageChange({
        ...baseInput,
        prorateOption: "NONE",
      });

      expect(result.applied).toBe(true);
      expect(result.prorateAmount).toBe(0n);
      expect(result.prorateInvoiceId).toBeUndefined();
      expect(result.creditApplied).toBeUndefined();
      expect(result.refundPaymentId).toBeUndefined();
      expect(repo.createProrateInvoice).not.toHaveBeenCalled();
      expect(repo.createRefundPaymentRecord).not.toHaveBeenCalled();
      expect(repo.recordProrateLog).toHaveBeenCalledOnce();
    });
  });

  // Pengajuan upgrade pelanggan yang lalu diterapkan admin seketika tetap
  // tercatat: admin melihat "Paket akan berubah ... pada 5 Januari 2027" dan
  // aplikasi "Pengajuan upgrade sedang diproses" untuk paket yang sudah aktif.
  describe("IMMEDIATE menghapus perubahan paket yang terjadwal", () => {
    it("pengajuan yang menunggu tidak tersisa", async () => {
      await service.applyPackageChange({ ...baseInput });

      expect(repo.clearPendingPackage).toHaveBeenCalledWith("pelanggan-1");
    });

    it("NEXT_CYCLE tidak menghapusnya", async () => {
      await service.applyPackageChange({
        ...baseInput,
        upgradeApplyTime: "NEXT_CYCLE",
      });

      expect(repo.clearPendingPackage).not.toHaveBeenCalled();
    });
  });

  describe("IMMEDIATE + PRORATE_CHARGE (upgrade)", () => {
    it("buat invoice prorate dengan amount pro-rata yang benar", async () => {
      repo.createProrateInvoice.mockResolvedValue("invoice-prorate-1");

      const result = await service.applyPackageChange({
        ...baseInput,
        prorateOption: "PRORATE_CHARGE",
        newHargaPaketId: "paket-baru-upgrade",
      });

      expect(result.applied).toBe(true);
      expect(result.prorateInvoiceId).toBe("invoice-prorate-1");
      // priceDiff = 100000, sisaHari = 18 (31 May - 13 May), totalHari = 30
      // charge = 100000 * 18 / 30 = 60000
      expect(result.prorateAmount).toBe(60000n);
      expect(repo.createProrateInvoice).toHaveBeenCalledOnce();
      expect(repo.createProrateInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          pelangganId: "pelanggan-1",
          amount: 60000n,
          tenantId: "tenant-1",
        }),
      );
    });

    it("tidak buat invoice kalau charge = 0 (sisaHari = 0)", async () => {
      repo.findPelangganProrateContext.mockResolvedValue({
        ...basePelanggan,
        jatuhTempo: new Date("2026-05-13T00:00:00Z"), // sudah jatuh tempo hari ini
      });

      const result = await service.applyPackageChange({
        ...baseInput,
        prorateOption: "PRORATE_CHARGE",
      });

      expect(result.prorateAmount).toBe(0n);
      expect(result.prorateInvoiceId).toBeUndefined();
      expect(repo.createProrateInvoice).not.toHaveBeenCalled();
    });
  });

  describe("IMMEDIATE + PRORATE_CREDIT + CREDIT (downgrade)", () => {
    it("increment saldoKreditRupiah pelanggan", async () => {
      repo.findPackagePair.mockResolvedValue({
        old: oldPackage,
        new: newPackageDowngrade,
      });

      const result = await service.applyPackageChange({
        ...baseInput,
        newHargaPaketId: "paket-baru-downgrade",
        prorateOption: "PRORATE_CREDIT",
        downgradeAdjustment: "CREDIT",
      });

      expect(result.applied).toBe(true);
      // priceDiff = -50000, credit = 50000 * 18 / 30 = 30000
      expect(result.creditApplied).toBe(30000n);
      expect(result.prorateAmount).toBe(-30000n);
      expect(repo.incrementSaldoKredit).toHaveBeenCalledWith(
        "pelanggan-1",
        30000n,
      );
      expect(repo.createRefundPaymentRecord).not.toHaveBeenCalled();
    });
  });

  describe("IMMEDIATE + PRORATE_CREDIT + REFUND (downgrade)", () => {
    it("buat refund payment record negatif", async () => {
      repo.findPackagePair.mockResolvedValue({
        old: oldPackage,
        new: newPackageDowngrade,
      });
      repo.createRefundPaymentRecord.mockResolvedValue("payment-refund-1");

      const result = await service.applyPackageChange({
        ...baseInput,
        newHargaPaketId: "paket-baru-downgrade",
        prorateOption: "PRORATE_CREDIT",
        downgradeAdjustment: "REFUND",
      });

      expect(result.applied).toBe(true);
      expect(result.refundPaymentId).toBe("payment-refund-1");
      expect(result.prorateAmount).toBe(-30000n);
      expect(repo.createRefundPaymentRecord).toHaveBeenCalledOnce();
      expect(repo.createRefundPaymentRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          pelangganId: "pelanggan-1",
          amount: 30000n,
          tenantId: "tenant-1",
        }),
      );
    });
  });

  describe("NEXT_CYCLE", () => {
    it("set pendingPackageId, revert hargaPaketId, applied=false", async () => {
      const result = await service.applyPackageChange({
        ...baseInput,
        upgradeApplyTime: "NEXT_CYCLE",
      });

      expect(result.applied).toBe(false);
      expect(result.prorateAmount).toBe(0n);
      expect(result.scheduledFor).toEqual(JATUH_TEMPO);
      expect(repo.schedulePackageChange).toHaveBeenCalledWith({
        pelangganId: "pelanggan-1",
        oldHargaPaketId: "paket-lama",
        newHargaPaketId: "paket-baru-upgrade",
        applyAt: JATUH_TEMPO,
      });
      expect(repo.createProrateInvoice).not.toHaveBeenCalled();
      expect(repo.createRefundPaymentRecord).not.toHaveBeenCalled();
      expect(repo.recordProrateLog).toHaveBeenCalledOnce();
    });

    // Tagihan siklus itu bisa sudah terbit (±5 hari sebelum jatuh tempo)
    // dengan harga paket lama sebelum perubahannya diajukan.
    it("tagihan siklus yang sudah terbit diselaraskan setelah jadwal tersimpan", async () => {
      const urutan: string[] = [];
      repo.schedulePackageChange.mockImplementation(async () => {
        urutan.push("schedule");
      });
      cycleInvoice.syncCycleInvoice.mockImplementation(async () => {
        urutan.push("sync");
        return { status: "REPRICED", invoiceId: "inv-baru" };
      });

      const result = await service.applyPackageChange({
        ...baseInput,
        upgradeApplyTime: "NEXT_CYCLE",
      });

      expect(cycleInvoice.syncCycleInvoice).toHaveBeenCalledWith({
        pelangganId: "pelanggan-1",
        cycleDate: JATUH_TEMPO,
        previousPackageId: "paket-lama",
        reason: "PACKAGE_CHANGED",
      });
      expect(urutan).toEqual(["schedule", "sync"]);
      expect(result.cycleInvoice).toEqual({
        status: "REPRICED",
        invoiceId: "inv-baru",
      });
    });

    it("jadwal yang menimpa jadwal lain menyelaraskan dari paket jadwal lama", async () => {
      repo.findPelangganProrateContext.mockResolvedValue({
        ...basePelanggan,
        pendingPackageId: "paket-jadwal-lama",
        pendingPackageApplyAt: JATUH_TEMPO,
      });

      await service.applyPackageChange({
        ...baseInput,
        upgradeApplyTime: "NEXT_CYCLE",
      });

      expect(cycleInvoice.syncCycleInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ previousPackageId: "paket-jadwal-lama" }),
      );
    });

    // Jadwalnya sudah tersimpan: gagal menyelaraskan tagihan tidak boleh
    // membuat pengajuan terlihat gagal lalu diulang.
    it("gagal menyelaraskan tagihan tidak menggagalkan penjadwalan", async () => {
      cycleInvoice.syncCycleInvoice.mockRejectedValue(new Error("redis mati"));

      const result = await service.applyPackageChange({
        ...baseInput,
        upgradeApplyTime: "NEXT_CYCLE",
      });

      expect(result.applied).toBe(false);
      expect(result.cycleInvoice).toEqual({ status: "FAILED" });
    });
  });

  describe("IMMEDIATE menggantikan jadwal", () => {
    it("tagihan siklus yang sudah dihitung dari paket jadwal diselaraskan lagi", async () => {
      repo.findPelangganProrateContext.mockResolvedValue({
        ...basePelanggan,
        pendingPackageId: "paket-jadwal",
        pendingPackageApplyAt: JATUH_TEMPO,
      });

      await service.applyPackageChange({ ...baseInput });

      expect(cycleInvoice.syncCycleInvoice).toHaveBeenCalledWith({
        pelangganId: "pelanggan-1",
        cycleDate: JATUH_TEMPO,
        previousPackageId: "paket-jadwal",
        reason: "PACKAGE_CHANGE_CANCELLED",
      });
    });

    it("tanpa jadwal, tagihan siklus tidak disentuh", async () => {
      await service.applyPackageChange({ ...baseInput });

      expect(cycleInvoice.syncCycleInvoice).not.toHaveBeenCalled();
    });
  });

  describe("syncCycleInvoiceAfterCancel", () => {
    it("tagihan siklus dikembalikan dari paket yang jadwalnya dibatalkan", async () => {
      cycleInvoice.syncCycleInvoice.mockResolvedValue({
        status: "REPRICED",
        invoiceId: "inv-pulih",
      });

      const result = await service.syncCycleInvoiceAfterCancel({
        pelangganId: "pelanggan-1",
        cancelledPackageId: "paket-baru-upgrade",
        applyAt: JATUH_TEMPO,
      });

      expect(cycleInvoice.syncCycleInvoice).toHaveBeenCalledWith({
        pelangganId: "pelanggan-1",
        cycleDate: JATUH_TEMPO,
        previousPackageId: "paket-baru-upgrade",
        reason: "PACKAGE_CHANGE_CANCELLED",
      });
      expect(result).toEqual({ status: "REPRICED", invoiceId: "inv-pulih" });
    });

    it("kegagalan dilaporkan sebagai FAILED, tidak dilempar", async () => {
      cycleInvoice.syncCycleInvoice.mockRejectedValue(new Error("gagal"));

      const result = await service.syncCycleInvoiceAfterCancel({
        pelangganId: "pelanggan-1",
        cancelledPackageId: "paket-baru-upgrade",
        applyAt: JATUH_TEMPO,
      });

      expect(result).toEqual({ status: "FAILED" });
    });
  });

  describe("Error handling", () => {
    it("throw InvoiceProrateError dengan code PELANGGAN_NOT_FOUND", async () => {
      repo.findPelangganProrateContext.mockResolvedValue(null);

      const err = await service.applyPackageChange(baseInput).catch((e) => e);
      expect(err.name).toBe("InvoiceProrateError");
      expect(err.code).toBe("PELANGGAN_NOT_FOUND");
      expect(err.message).toContain("tidak ditemukan");
    });

    it("throw InvoiceProrateError dengan code PACKAGE_NOT_FOUND", async () => {
      repo.findPackagePair.mockResolvedValue(null);

      const err = await service.applyPackageChange(baseInput).catch((e) => e);
      expect(err.name).toBe("InvoiceProrateError");
      expect(err.code).toBe("PACKAGE_NOT_FOUND");
      expect(err.message).toContain("Paket lama atau baru tidak ditemukan");
    });
  });
});
