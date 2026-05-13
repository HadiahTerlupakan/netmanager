import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceProrateService } from "@/modules/finance/services/InvoiceProrateService";
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
  incrementSaldoKredit: vi.fn().mockResolvedValue(undefined),
  createProrateInvoice: vi.fn(),
  createRefundPaymentRecord: vi.fn(),
  recordProrateLog: vi.fn().mockResolvedValue(undefined),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("InvoiceProrateService", () => {
  let repo: ReturnType<typeof buildMockRepo>;
  let service: InvoiceProrateService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
    repo = buildMockRepo();
    service = new InvoiceProrateService(repo as unknown as IProrateRepository);

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
  });

  describe("Error handling", () => {
    it("throw InvoiceProrateError dengan code PELANGGAN_NOT_FOUND", async () => {
      repo.findPelangganProrateContext.mockResolvedValue(null);

      await expect(service.applyPackageChange(baseInput)).rejects.toThrow(
        "tidak ditemukan",
      );
    });

    it("throw InvoiceProrateError dengan code PACKAGE_NOT_FOUND", async () => {
      repo.findPackagePair.mockResolvedValue(null);

      await expect(service.applyPackageChange(baseInput)).rejects.toThrow(
        "Paket lama atau baru tidak ditemukan",
      );
    });
  });
});
