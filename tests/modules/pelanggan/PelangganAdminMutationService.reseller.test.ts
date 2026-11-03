import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import { ResellerValidationError } from "@/modules/reseller/errors/reseller-errors";
import { PelangganAdminMutationService } from "@/modules/pelanggan/services/PelangganAdminMutationService";

const mockFns = vi.hoisted(() => ({
  validateCustomerRelation: vi.fn(),
}));

vi.mock("@/modules/database", () => ({ prisma: prismaMock }));

vi.mock("@/modules/events", () => ({
  CustomerEventDispatcher: {
    onUpdated: vi.fn(),
    onActivated: vi.fn(),
    onIsolated: vi.fn(),
    onSuspended: vi.fn(),
  },
  BillingEventDispatcher: { onPackageChanged: vi.fn() },
}));

vi.mock("@/modules/finance/services/CycleInvoiceRepriceService", () => ({
  CycleInvoiceRepriceService: class {
    syncCycleInvoice = vi.fn(async () => ({ status: "NOT_ISSUED" }));
  },
}));

vi.mock("@/modules/reseller", () => ({
  getResellerCustomerRelationService: () => ({
    validateCustomerRelation: mockFns.validateCustomerRelation,
  }),
}));

const TENANT_ADMIN_SESSION = {
  user: { id: "admin-1", role: "ADMIN", tenantId: "tenant-1" },
};
const SUPER_ADMIN_SESSION = {
  user: {
    id: "root",
    role: "SUPER_ADMIN",
    tenantId: null as string | null,
    isSuperAdmin: true,
  },
};

const INPUT_DATA = {
  idPelanggan: "PLG-001",
  nama: "Budi",
  username: "budi",
  password: "pass123",
  hargaPaketId: "pkg-1",
  resellerId: "reseller-1",
  resellerOutletId: "outlet-1",
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
  nama: "Budi",
  username: "budi",
  password: "pass123",
  hargaPaketId: "pkg-1",
  tipe: "REGULER",
  status: "AKTIF",
  autoIsolir: true,
  email: null as string | null,
  siteId: null as string | null,
  odpId: null as string | null,
  tenantId: "tenant-pelanggan",
  resellerId: "reseller-1",
  resellerOutletId: "outlet-1",
  passwordHash: null as string | null,
  tanggalAktif: new Date("2024-01-01"),
  jatuhTempo: new Date("2024-02-01"),
};

describe("PelangganAdminMutationService — relasi reseller saat edit PPP", () => {
  let repository: {
    findForAdminMutation: ReturnType<typeof vi.fn>;
    updateAdminPppById: ReturnType<typeof vi.fn>;
  };
  let service: PelangganAdminMutationService;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = {
      findForAdminMutation: vi.fn().mockResolvedValue(EXISTING_PELANGGAN),
      updateAdminPppById: vi.fn().mockResolvedValue(EXISTING_PELANGGAN),
    };
    service = new PelangganAdminMutationService(repository as never);
    // Relasi tersimpan menunjuk reseller yang kini nonaktif.
    mockFns.validateCustomerRelation.mockRejectedValue(
      new ResellerValidationError("Reseller tidak aktif"),
    );
  });

  it("tetap bisa menyimpan field lain bila reseller tidak diubah meski reseller kini nonaktif", async () => {
    await service.updatePppById({
      id: "pel-1",
      session: TENANT_ADMIN_SESSION as never,
      data: { ...INPUT_DATA, nama: "Budi Baru" },
    });

    expect(mockFns.validateCustomerRelation).not.toHaveBeenCalled();
    expect(repository.updateAdminPppById).toHaveBeenCalledOnce();
  });

  it("memvalidasi relasi yang berubah terhadap tenant pelanggan, bukan tenant sesi", async () => {
    mockFns.validateCustomerRelation.mockResolvedValueOnce({
      resellerId: "reseller-2",
      resellerOutletId: null,
    });

    await service.updatePppById({
      id: "pel-1",
      session: SUPER_ADMIN_SESSION as never,
      data: { ...INPUT_DATA, resellerId: "reseller-2", resellerOutletId: null },
    });

    expect(mockFns.validateCustomerRelation).toHaveBeenCalledWith({
      tenantId: "tenant-pelanggan",
      resellerId: "reseller-2",
      resellerOutletId: null,
    });
  });

  it("menolak pindah ke reseller nonaktif dengan pesan yang jelas", async () => {
    await expect(
      service.updatePppById({
        id: "pel-1",
        session: TENANT_ADMIN_SESSION as never,
        data: { ...INPUT_DATA, resellerId: "reseller-2" },
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Reseller tidak aktif",
    });
    expect(repository.updateAdminPppById).not.toHaveBeenCalled();
  });
});
