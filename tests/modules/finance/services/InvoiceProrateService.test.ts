import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceProrateService } from "@/modules/finance/services/InvoiceProrateService";

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

// Hoist mock objects supaya bisa dipakai di dalam vi.mock factory
const mockPrisma = vi.hoisted(() => ({
  pelanggan: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  hargaPaket: {
    findUnique: vi.fn(),
  },
  proratePaymentLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/modules/database", () => ({
  prisma: mockPrisma,
}));

const mockPrismaBilling = vi.hoisted(() => ({
  invoice: {
    create: vi.fn(),
  },
  payment: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma-billing", () => ({
  prismaBilling: mockPrismaBilling,
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
  tenantId: "tenant-1",
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("InvoiceProrateService", () => {
  let service: InvoiceProrateService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
    service = new InvoiceProrateService();

    // Default mocks
    mockPrisma.pelanggan.findUnique.mockResolvedValue(basePelanggan);
    mockPrisma.pelanggan.update.mockResolvedValue(basePelanggan);
    mockPrisma.proratePaymentLog.create.mockResolvedValue({ id: "log-1" });
  });

  describe("IMMEDIATE + NONE", () => {
    it("tidak buat invoice/credit/refund, hanya log", async () => {
      mockPrisma.hargaPaket.findUnique
        .mockResolvedValueOnce(oldPackage)
        .mockResolvedValueOnce(newPackageUpgrade);

      const result = await service.applyPackageChange({
        ...baseInput,
        prorateOption: "NONE",
      });

      expect(result.applied).toBe(true);
      expect(result.prorateAmount).toBe(BigInt(0));
      expect(result.prorateInvoiceId).toBeUndefined();
      expect(result.creditApplied).toBeUndefined();
      expect(result.refundPaymentId).toBeUndefined();
      expect(mockPrismaBilling.invoice.create).not.toHaveBeenCalled();
      expect(mockPrismaBilling.payment.create).not.toHaveBeenCalled();
      expect(mockPrisma.proratePaymentLog.create).toHaveBeenCalledOnce();
    });
  });

  describe("IMMEDIATE + PRORATE_CHARGE (upgrade)", () => {
    it("buat invoice prorate dengan amount pro-rata yang benar", async () => {
      mockPrisma.hargaPaket.findUnique
        .mockResolvedValueOnce(oldPackage)
        .mockResolvedValueOnce(newPackageUpgrade);

      mockPrismaBilling.invoice.create.mockResolvedValue({
        id: "invoice-prorate-1",
      });

      const result = await service.applyPackageChange({
        ...baseInput,
        prorateOption: "PRORATE_CHARGE",
        newHargaPaketId: "paket-baru-upgrade",
      });

      expect(result.applied).toBe(true);
      expect(result.prorateInvoiceId).toBe("invoice-prorate-1");
      // priceDiff = 100000, sisaHari = 18 (31 May - 13 May), totalHari = 30
      // charge = 100000 * 18 / 30 = 60000
      expect(result.prorateAmount).toBe(BigInt(60000));
      expect(mockPrismaBilling.invoice.create).toHaveBeenCalledOnce();
      expect(mockPrismaBilling.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "SENT",
            subtotal: BigInt(60000),
            totalAmount: BigInt(60000),
          }),
        }),
      );
    });

    it("tidak buat invoice kalau charge = 0 (sisaHari = 0)", async () => {
      const pelangganExpired = {
        ...basePelanggan,
        jatuhTempo: new Date("2026-05-13T00:00:00Z"), // sudah jatuh tempo hari ini
      };
      mockPrisma.pelanggan.findUnique.mockResolvedValue(pelangganExpired);
      mockPrisma.hargaPaket.findUnique
        .mockResolvedValueOnce(oldPackage)
        .mockResolvedValueOnce(newPackageUpgrade);

      const result = await service.applyPackageChange({
        ...baseInput,
        prorateOption: "PRORATE_CHARGE",
      });

      expect(result.prorateAmount).toBe(BigInt(0));
      expect(result.prorateInvoiceId).toBeUndefined();
      expect(mockPrismaBilling.invoice.create).not.toHaveBeenCalled();
    });
  });

  describe("IMMEDIATE + PRORATE_CREDIT + CREDIT (downgrade)", () => {
    it("increment saldoKreditRupiah pelanggan", async () => {
      mockPrisma.hargaPaket.findUnique
        .mockResolvedValueOnce(oldPackage)
        .mockResolvedValueOnce(newPackageDowngrade);

      const result = await service.applyPackageChange({
        ...baseInput,
        newHargaPaketId: "paket-baru-downgrade",
        prorateOption: "PRORATE_CREDIT",
        downgradeAdjustment: "CREDIT",
      });

      expect(result.applied).toBe(true);
      // priceDiff = -50000, credit = 50000 * 18 / 30 = 30000
      expect(result.creditApplied).toBe(BigInt(30000));
      expect(result.prorateAmount).toBe(-BigInt(30000));
      expect(mockPrisma.pelanggan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            saldoKreditRupiah: { increment: BigInt(30000) },
          }),
        }),
      );
      expect(mockPrismaBilling.payment.create).not.toHaveBeenCalled();
    });
  });

  describe("IMMEDIATE + PRORATE_CREDIT + REFUND (downgrade)", () => {
    it("buat refund payment record negatif", async () => {
      mockPrisma.hargaPaket.findUnique
        .mockResolvedValueOnce(oldPackage)
        .mockResolvedValueOnce(newPackageDowngrade);

      mockPrismaBilling.payment.create.mockResolvedValue({
        id: "payment-refund-1",
      });

      const result = await service.applyPackageChange({
        ...baseInput,
        newHargaPaketId: "paket-baru-downgrade",
        prorateOption: "PRORATE_CREDIT",
        downgradeAdjustment: "REFUND",
      });

      expect(result.applied).toBe(true);
      expect(result.refundPaymentId).toBe("payment-refund-1");
      expect(result.prorateAmount).toBe(-BigInt(30000));
      expect(mockPrismaBilling.payment.create).toHaveBeenCalledOnce();
      expect(mockPrismaBilling.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: -BigInt(30000),
            paymentMethod: "OTHER",
            gatewayStatus: "PENDING",
          }),
        }),
      );
    });
  });

  describe("NEXT_CYCLE", () => {
    it("set pendingPackageId, revert hargaPaketId, applied=false", async () => {
      mockPrisma.hargaPaket.findUnique
        .mockResolvedValueOnce(oldPackage)
        .mockResolvedValueOnce(newPackageUpgrade);

      const result = await service.applyPackageChange({
        ...baseInput,
        upgradeApplyTime: "NEXT_CYCLE",
      });

      expect(result.applied).toBe(false);
      expect(result.prorateAmount).toBe(BigInt(0));
      expect(result.scheduledFor).toEqual(JATUH_TEMPO);
      expect(mockPrisma.pelanggan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hargaPaketId: "paket-lama", // reverted
            pendingPackageId: "paket-baru-upgrade",
            pendingPackageApplyAt: JATUH_TEMPO,
          }),
        }),
      );
      expect(mockPrismaBilling.invoice.create).not.toHaveBeenCalled();
      expect(mockPrismaBilling.payment.create).not.toHaveBeenCalled();
      expect(mockPrisma.proratePaymentLog.create).toHaveBeenCalledOnce();
    });
  });

  describe("Error handling", () => {
    it("throw error kalau pelanggan tidak ditemukan", async () => {
      mockPrisma.pelanggan.findUnique.mockResolvedValue(null);

      await expect(service.applyPackageChange(baseInput)).rejects.toThrow(
        "tidak ditemukan",
      );
    });

    it("throw error kalau paket tidak ditemukan", async () => {
      mockPrisma.hargaPaket.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(service.applyPackageChange(baseInput)).rejects.toThrow(
        "Paket lama atau baru tidak ditemukan",
      );
    });
  });
});
