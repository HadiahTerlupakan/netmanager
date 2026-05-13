import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import { PelangganAdminMutationService } from "@/modules/pelanggan/services/PelangganAdminMutationService";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockFns = vi.hoisted(() => ({
  onPackageChanged: vi.fn(),
  onUpdated: vi.fn(),
  onActivated: vi.fn(),
  onIsolated: vi.fn(),
  onSuspended: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/events", () => ({
  CustomerEventDispatcher: {
    onUpdated: mockFns.onUpdated,
    onActivated: mockFns.onActivated,
    onIsolated: mockFns.onIsolated,
    onSuspended: mockFns.onSuspended,
  },
  BillingEventDispatcher: {
    onPackageChanged: mockFns.onPackageChanged,
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION = {
  user: {
    id: "admin-1",
    role: "ADMIN",
    tenantId: "tenant-1",
    isSuperAdmin: false,
  },
};

const BASE_INPUT_DATA = {
  idPelanggan: "PLG-001",
  nama: "Budi Santoso",
  username: "budi",
  password: "pass123",
  hargaPaketId: "pkg-new",
  tipe: "REGULER" as string | null,
  tanggalAktif: "2024-01-01",
  jatuhTempo: "2024-02-01",
  status: "AKTIF" as string | null,
  autoIsolir: true,
  email: null as string | null,
  siteId: null as string | null,
  invoiceAction: null as string | null,
  passwordLogin: null as string | null,
};

const EXISTING_PELANGGAN = {
  id: "pel-1",
  idPelanggan: "PLG-001",
  nama: "Budi Santoso",
  username: "budi",
  password: "pass123",
  hargaPaketId: "pkg-old",
  tipe: "REGULER",
  status: "AKTIF",
  autoIsolir: true,
  email: null as string | null,
  siteId: null as string | null,
  tenantId: "tenant-1",
  passwordHash: null as string | null,
  tanggalAktif: new Date("2024-01-01"),
  jatuhTempo: new Date("2024-02-01"),
};

const UPDATED_PELANGGAN = {
  ...EXISTING_PELANGGAN,
  hargaPaketId: "pkg-new",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PelangganAdminMutationService — emit PACKAGE_CHANGED", () => {
  let repository: {
    findForAdminMutation: ReturnType<typeof vi.fn>;
    updateAdminPppById: ReturnType<typeof vi.fn>;
    findForAdminDelete: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let service: PelangganAdminMutationService;

  beforeEach(() => {
    vi.clearAllMocks();

    repository = {
      findForAdminMutation: vi.fn().mockResolvedValue(EXISTING_PELANGGAN),
      updateAdminPppById: vi.fn().mockResolvedValue(UPDATED_PELANGGAN),
      findForAdminDelete: vi.fn(),
      delete: vi.fn(),
    };

    service = new PelangganAdminMutationService(repository as never);
  });

  it("emit PACKAGE_CHANGED saat hargaPaketId berubah dengan applyTime IMMEDIATE (default)", async () => {
    prismaMock.pelanggan.findUnique.mockResolvedValue({
      id: "pel-1",
      jatuhTempo: new Date("2026-06-01"),
      tanggalAktif: new Date("2026-05-01"),
      hargaPaketId: "pkg-old",
      tenantId: "tenant-1",
    });
    prismaMock.hargaPaket.findUnique.mockImplementation(({ where }) => {
      if (where.id === "pkg-old") {
        return Promise.resolve({
          id: "pkg-old",
          harga: 100_000,
          durasi: 30,
          durasiUnit: "HARI",
          profilePPP: { name: "Profile-10M" },
        });
      }
      return Promise.resolve({
        id: "pkg-new",
        harga: 150_000,
        durasi: 30,
        durasiUnit: "HARI",
        profilePPP: { name: "Profile-20M" },
      });
    });
    prismaMock.pelanggan.update.mockResolvedValue({});
    prismaMock.proratePaymentLog.create.mockResolvedValue({});

    await service.updatePppById({
      id: "pel-1",
      session: SESSION as never,
      data: BASE_INPUT_DATA,
    });

    expect(mockFns.onPackageChanged).toHaveBeenCalledOnce();
    expect(mockFns.onPackageChanged).toHaveBeenCalledWith({
      customerId: "pel-1",
      customerName: "Budi Santoso",
      oldPackageId: "pkg-old",
      newPackageId: "pkg-new",
      oldProfileName: "Profile-10M",
      newProfileName: "Profile-20M",
      oldPackagePrice: 100_000,
      newPackagePrice: 150_000,
      applyTime: "IMMEDIATE",
      tenantId: "tenant-1",
    });
  });

  it("tidak emit PACKAGE_CHANGED saat applyTime NEXT_CYCLE (handler emit oleh cron PendingPackageApplier)", async () => {
    prismaMock.pelanggan.findUnique.mockResolvedValue({
      id: "pel-1",
      jatuhTempo: new Date("2026-06-01"),
      tanggalAktif: new Date("2026-05-01"),
      hargaPaketId: "pkg-old",
      tenantId: "tenant-1",
    });
    prismaMock.hargaPaket.findUnique.mockImplementation(({ where }) => {
      if (where.id === "pkg-old") {
        return Promise.resolve({
          id: "pkg-old",
          harga: 100_000,
          durasi: 30,
          durasiUnit: "HARI",
          profilePPP: { name: "Profile-10M" },
        });
      }
      return Promise.resolve({
        id: "pkg-new",
        harga: 150_000,
        durasi: 30,
        durasiUnit: "HARI",
        profilePPP: { name: "Profile-20M" },
      });
    });
    prismaMock.pelanggan.update.mockResolvedValue({});
    prismaMock.proratePaymentLog.create.mockResolvedValue({});

    await service.updatePppById({
      id: "pel-1",
      session: SESSION as never,
      upgradeApplyTime: "NEXT_CYCLE",
      data: BASE_INPUT_DATA,
    });

    // NEXT_CYCLE → InvoiceProrateService revert hargaPaketId in-memory,
    // syncUpdatedCustomer tidak detect package change.
    expect(mockFns.onPackageChanged).not.toHaveBeenCalled();
  });

  it("tidak emit PACKAGE_CHANGED saat hargaPaketId tidak berubah", async () => {
    repository.updateAdminPppById.mockResolvedValue({
      ...EXISTING_PELANGGAN,
      hargaPaketId: "pkg-old", // sama dengan existing
    });

    await service.updatePppById({
      id: "pel-1",
      session: SESSION as never,
      data: { ...BASE_INPUT_DATA, hargaPaketId: "pkg-old" },
    });

    expect(mockFns.onPackageChanged).not.toHaveBeenCalled();
  });

  it("tetap return hasil update meski resolvePackageContext gagal (best-effort)", async () => {
    prismaMock.pelanggan.findUnique.mockResolvedValue({
      id: "pel-1",
      jatuhTempo: new Date("2026-06-01"),
      tanggalAktif: new Date("2026-05-01"),
      hargaPaketId: "pkg-old",
      tenantId: "tenant-1",
    });
    prismaMock.hargaPaket.findUnique.mockRejectedValue(new Error("DB timeout"));
    prismaMock.pelanggan.update.mockResolvedValue({});
    prismaMock.proratePaymentLog.create.mockResolvedValue({});

    const result = await service.updatePppById({
      id: "pel-1",
      session: SESSION as never,
      data: BASE_INPUT_DATA,
    });

    // Update tetap sukses
    expect(result).toBeDefined();
    expect(result.id).toBe("pel-1");
    // Event tidak ter-emit karena error, tapi tidak throw
    expect(mockFns.onPackageChanged).not.toHaveBeenCalled();
  });
});
