import { beforeEach, describe, expect, it, vi } from "vitest";
import { PendingPackageApplierService } from "@/modules/finance/services/PendingPackageApplierService";

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
    findMany: vi.fn(),
    update: vi.fn(),
  },
  hargaPaket: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/modules/database", () => ({
  prisma: mockPrisma,
}));

const mockOnPackageChanged = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: {
    onPackageChanged: mockOnPackageChanged,
  },
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW = new Date("2026-05-13T10:00:00Z");

const oldPkg = {
  harga: 100000,
  profilePPP: { name: "profile-lama" },
};

const newPkg = {
  harga: 200000,
  profilePPP: { name: "profile-baru" },
};

const candidatePelanggan = {
  id: "pelanggan-1",
  nama: "Budi Santoso",
  hargaPaketId: "paket-lama",
  pendingPackageId: "paket-baru",
  tenantId: "tenant-1",
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PendingPackageApplierService", () => {
  let service: PendingPackageApplierService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
    service = new PendingPackageApplierService();
  });

  describe("applyDuePending", () => {
    it("mengembalikan zero applied/failed kalau tidak ada kandidat", async () => {
      mockPrisma.pelanggan.findMany.mockResolvedValue([]);

      const result = await service.applyDuePending();

      expect(result.applied).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockPrisma.pelanggan.update).not.toHaveBeenCalled();
      expect(mockOnPackageChanged).not.toHaveBeenCalled();
    });

    it("apply kandidat yang sudah jatuh tempo dan emit PACKAGE_CHANGED", async () => {
      mockPrisma.pelanggan.findMany.mockResolvedValue([candidatePelanggan]);
      mockPrisma.hargaPaket.findUnique
        .mockResolvedValueOnce(oldPkg)
        .mockResolvedValueOnce(newPkg);
      mockPrisma.pelanggan.update.mockResolvedValue({
        ...candidatePelanggan,
        hargaPaketId: "paket-baru",
        pendingPackageId: null,
        pendingPackageApplyAt: null,
      });

      const result = await service.applyDuePending();

      expect(result.applied).toBe(1);
      expect(result.failed).toBe(0);

      // Verifikasi update DB
      expect(mockPrisma.pelanggan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pelanggan-1" },
          data: expect.objectContaining({
            hargaPaketId: "paket-baru",
            pendingPackageId: null,
            pendingPackageApplyAt: null,
          }),
        }),
      );

      // Verifikasi event emit
      expect(mockOnPackageChanged).toHaveBeenCalledOnce();
      expect(mockOnPackageChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: "pelanggan-1",
          oldPackageId: "paket-lama",
          newPackageId: "paket-baru",
          applyTime: "IMMEDIATE",
          tenantId: "tenant-1",
        }),
      );
    });

    it("increment failed counter kalau paket tidak ditemukan", async () => {
      mockPrisma.pelanggan.findMany.mockResolvedValue([candidatePelanggan]);
      mockPrisma.hargaPaket.findUnique
        .mockResolvedValueOnce(null) // oldPkg tidak ditemukan
        .mockResolvedValueOnce(null);

      const result = await service.applyDuePending();

      expect(result.applied).toBe(0);
      expect(result.failed).toBe(1);
      expect(mockPrisma.pelanggan.update).not.toHaveBeenCalled();
      expect(mockOnPackageChanged).not.toHaveBeenCalled();
    });

    it("lanjut ke kandidat berikutnya kalau satu gagal", async () => {
      const candidate2 = {
        ...candidatePelanggan,
        id: "pelanggan-2",
        nama: "Siti Rahayu",
      };

      mockPrisma.pelanggan.findMany.mockResolvedValue([
        candidatePelanggan,
        candidate2,
      ]);

      // Kandidat 1: paket tidak ditemukan → fail
      // Kandidat 2: sukses
      mockPrisma.hargaPaket.findUnique
        .mockResolvedValueOnce(null) // oldPkg kandidat 1
        .mockResolvedValueOnce(null) // newPkg kandidat 1
        .mockResolvedValueOnce(oldPkg) // oldPkg kandidat 2
        .mockResolvedValueOnce(newPkg); // newPkg kandidat 2

      mockPrisma.pelanggan.update.mockResolvedValue({});

      const result = await service.applyDuePending();

      expect(result.applied).toBe(1);
      expect(result.failed).toBe(1);
      expect(mockOnPackageChanged).toHaveBeenCalledOnce();
    });

    it("query DB dengan filter pendingPackageApplyAt <= now", async () => {
      mockPrisma.pelanggan.findMany.mockResolvedValue([]);

      await service.applyDuePending();

      expect(mockPrisma.pelanggan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pendingPackageId: { not: null },
            pendingPackageApplyAt: { lte: NOW },
          }),
        }),
      );
    });
  });
});
