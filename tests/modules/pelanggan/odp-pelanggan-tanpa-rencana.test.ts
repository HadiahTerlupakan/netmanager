import { beforeEach, describe, expect, it, vi } from "vitest";

const isInstalledOdp = vi.hoisted(() => vi.fn());

vi.mock("@/modules/map", () => ({
  getMappingService: () => ({ isInstalledOdp }),
}));
vi.mock("@/modules/reseller", () => ({
  getResellerCustomerRelationService: () => ({
    validateCustomerRelation: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("@/lib/validations/global-identifier", () => ({
  checkGlobalIdentifier: vi.fn().mockResolvedValue({ exists: false }),
}));
vi.mock("@/modules/events", () => ({ CustomerEventDispatcher: {} }));
vi.mock("@/modules/database", () => ({ prisma: {} }));

import { isOdpAssignable } from "@/modules/pelanggan/services/pelanggan-odp.validator";
import { validateCreatePelangganInput } from "@/modules/pelanggan/services/pelanggan-service.helpers";
import { PelangganAdminMutationService } from "@/modules/pelanggan/services/PelangganAdminMutationService";

describe("isOdpAssignable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menolak odpId yang menunjuk node rencana atau bukan ODP", async () => {
    isInstalledOdp.mockResolvedValue(false);
    await expect(
      isOdpAssignable("odp-rencana", { tenantId: "t1" }),
    ).resolves.toBe(false);
    expect(isInstalledOdp).toHaveBeenCalledWith(
      { tenantId: "t1", isSuperAdmin: false },
      "odp-rencana",
    );
  });

  it("menerima node nyata bertipe odp", async () => {
    isInstalledOdp.mockResolvedValue(true);
    await expect(isOdpAssignable("odp-1", { tenantId: "t1" })).resolves.toBe(
      true,
    );
  });

  it.each([null, undefined, ""])("menerima odpId kosong (%s)", async (v) => {
    await expect(isOdpAssignable(v, { tenantId: "t1" })).resolves.toBe(true);
    expect(isInstalledOdp).not.toHaveBeenCalled();
  });
});

describe("validateCreatePelangganInput: odpId", () => {
  const repository = {
    checkHargaPaketExists: vi.fn().mockResolvedValue(true),
  } as never;
  const buatInput = (odpId: string | null): never =>
    ({
      idPelanggan: "12345678",
      username: "budi",
      hargaPaketId: "pkg-1",
      tenantId: "t1",
      odpId,
    }) as never;

  beforeEach(() => vi.clearAllMocks());

  it("menolak pelanggan baru yang menunjuk node rencana", async () => {
    isInstalledOdp.mockResolvedValue(false);
    await expect(
      validateCreatePelangganInput(repository, buatInput("odp-rencana")),
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
  });

  it("menerima ODP nyata", async () => {
    isInstalledOdp.mockResolvedValue(true);
    await expect(
      validateCreatePelangganInput(repository, buatInput("odp-1")),
    ).resolves.toBeUndefined();
  });

  it("menerima odpId null", async () => {
    await expect(
      validateCreatePelangganInput(repository, buatInput(null)),
    ).resolves.toBeUndefined();
    expect(isInstalledOdp).not.toHaveBeenCalled();
  });
});

describe("PelangganAdminMutationService.updatePppById: odpId", () => {
  const session = {
    user: { id: "a", role: "ADMIN", tenantId: "t1", isSuperAdmin: false },
  };
  const existing = {
    id: "pel-1",
    hargaPaketId: "pkg-1",
    tipe: "REGULER",
    status: "AKTIF",
    siteId: null as string | null,
    odpId: "odp-lama",
    passwordHash: null as string | null,
    password: "x",
  };
  const buatInput = (odpId: string | null): never =>
    ({
      id: "pel-1",
      session,
      data: {
        idPelanggan: "PLG-1",
        nama: "Budi",
        username: "budi",
        password: "x",
        hargaPaketId: "pkg-1",
        tipe: "REGULER",
        tanggalAktif: "2024-01-01",
        jatuhTempo: "2024-02-01",
        status: "AKTIF",
        autoIsolir: true,
        email: null,
        siteId: null,
        odpId,
        invoiceAction: null,
        passwordLogin: null,
      },
    }) as never;

  function buatService() {
    const repository = {
      findForAdminMutation: vi.fn().mockResolvedValue(existing),
      updateAdminPppById: vi.fn().mockResolvedValue({ ...existing }),
    };
    return {
      repository,
      service: new PelangganAdminMutationService(repository as never),
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it("menolak perubahan ke node rencana dengan BAD_REQUEST dan tidak menulis", async () => {
    isInstalledOdp.mockResolvedValue(false);
    const { service, repository } = buatService();
    await expect(
      service.updatePppById(buatInput("odp-rencana")),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(repository.updateAdminPppById).not.toHaveBeenCalled();
  });

  it("tidak memvalidasi ulang ODP yang tidak berubah", async () => {
    const { service } = buatService();
    await service
      .updatePppById(buatInput("odp-lama"))
      .catch((): void => undefined);
    expect(isInstalledOdp).not.toHaveBeenCalled();
  });

  it("menerima ODP nyata yang baru", async () => {
    isInstalledOdp.mockResolvedValue(true);
    const { service, repository } = buatService();
    await service
      .updatePppById(buatInput("odp-baru"))
      .catch((): void => undefined);
    expect(repository.updateAdminPppById).toHaveBeenCalled();
  });
});
