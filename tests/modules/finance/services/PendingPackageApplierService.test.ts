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
    updateMany: vi.fn(),
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
    it("mengembalikan zero applied/failed/staleSkipped kalau tidak ada kandidat", async () => {
      mockPrisma.pelanggan.findMany.mockResolvedValue([]);

      const result = await service.applyDuePending();

      expect(result.applied).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.staleSkipped).toBe(0);
      expect(mockPrisma.pelanggan.updateMany).not.toHaveBeenCalled();
      expect(mockOnPackageChanged).not.toHaveBeenCalled();
    });

    it("apply kandidat yang sudah jatuh tempo dan emit PACKAGE_CHANGED", async () => {
      mockPrisma.pelanggan.findMany.mockResolvedValue([candidatePelanggan]);
      mockPrisma.pelanggan.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.hargaPaket.findUnique
        .mockResolvedValueOnce(oldPkg)
        .mockResolvedValueOnce(newPkg);

      const result = await service.applyDuePending();

      expect(result.applied).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.staleSkipped).toBe(0);

      // Optimistic update — WHERE harus include id + hargaPaketId snapshot +
      // pendingPackageId snapshot supaya atomic terhadap mutasi konkuren.
      expect(mockPrisma.pelanggan.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "pelanggan-1",
            hargaPaketId: "paket-lama",
            pendingPackageId: "paket-baru",
            pendingPackageApplyAt: { lte: NOW },
          }),
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

    it("skip sebagai stale (bukan failed) kalau state berubah konkuren — updateMany count 0", async () => {
      mockPrisma.pelanggan.findMany.mockResolvedValue([candidatePelanggan]);
      mockPrisma.pelanggan.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.applyDuePending();

      expect(result.applied).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.staleSkipped).toBe(1);
      // Tidak fetch package, tidak emit event saat stale
      expect(mockPrisma.hargaPaket.findUnique).not.toHaveBeenCalled();
      expect(mockOnPackageChanged).not.toHaveBeenCalled();
    });

    it("increment failed counter kalau paket tidak ditemukan setelah apply", async () => {
      mockPrisma.pelanggan.findMany.mockResolvedValue([candidatePelanggan]);
      mockPrisma.pelanggan.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.hargaPaket.findUnique
        .mockResolvedValueOnce(null) // oldPkg tidak ditemukan
        .mockResolvedValueOnce(null);

      const result = await service.applyDuePending();

      expect(result.applied).toBe(0);
      expect(result.failed).toBe(1);
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
      mockPrisma.pelanggan.updateMany.mockResolvedValue({ count: 1 });

      // Kandidat 1: paket tidak ditemukan → fail
      // Kandidat 2: sukses
      mockPrisma.hargaPaket.findUnique
        .mockResolvedValueOnce(null) // oldPkg kandidat 1
        .mockResolvedValueOnce(null) // newPkg kandidat 1
        .mockResolvedValueOnce(oldPkg) // oldPkg kandidat 2
        .mockResolvedValueOnce(newPkg); // newPkg kandidat 2

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

    it("hormati applyAtBefore param sebagai cutoff window", async () => {
      const customCutoff = new Date("2026-05-13T18:00:00Z");
      mockPrisma.pelanggan.findMany.mockResolvedValue([]);

      await service.applyDuePending(customCutoff);

      expect(mockPrisma.pelanggan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pendingPackageApplyAt: { lte: customCutoff },
          }),
        }),
      );
    });
  });
});
