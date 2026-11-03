import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IResellerComplianceSettings } from "@/modules/reseller/domain/ports/IResellerComplianceSettings";
import type { IResellerPksDirectory } from "@/modules/reseller/domain/ports/IResellerPksDirectory";
import type { IResellerRepository } from "@/modules/reseller/domain/ports/IResellerRepository";
import type { PksContractSnapshot } from "@/modules/reseller/domain/reseller-compliance";
import { ResellerComplianceService } from "@/modules/reseller/services/ResellerComplianceService";
import { ResellerCustomerRelationService } from "@/modules/reseller/services/ResellerCustomerRelationService";
import {
  buildReseller,
  createResellerRepositoryMock,
} from "./reseller-fixtures";

const ACTIVE_PKS: PksContractSnapshot = {
  documentId: "doc-1",
  startDate: null,
  endDate: new Date("2027-11-03T00:00:00.000Z"),
  daysLeft: 365,
  hasStarted: true,
};

const COMPLIANT = buildReseller({
  id: "reseller-ok",
  nib: "1234567890123",
  kbliCode: "61994",
  standardCertificateNumber: "SS-001",
  licenseVerifiedAt: new Date("2026-10-01T00:00:00.000Z"),
});
const NON_COMPLIANT = buildReseller({
  id: "reseller-bad",
  name: "Reseller Liar",
});

function createPksDirectory(
  contracts: Record<string, PksContractSnapshot[]>,
): IResellerPksDirectory {
  return {
    listContractsByReseller: vi.fn(
      async () => new Map(Object.entries(contracts)),
    ),
  };
}

function createSettings(isRequired: boolean): IResellerComplianceSettings {
  return {
    isComplianceRequired: vi.fn().mockResolvedValue(isRequired),
    setComplianceRequired: vi.fn().mockResolvedValue(undefined),
    isSettlementSeparateApproverRequired: vi.fn().mockResolvedValue(false),
    setSettlementSeparateApproverRequired: vi.fn().mockResolvedValue(undefined),
  };
}

describe("ResellerComplianceService", () => {
  let repository: IResellerRepository;

  beforeEach(() => {
    repository = createResellerRepositoryMock();
  });

  it("daftar reseller membawa status PKS dan kepatuhan, satu query PKS per halaman", async () => {
    vi.mocked(repository.findAll).mockResolvedValueOnce({
      items: [COMPLIANT, NON_COMPLIANT],
      total: 2,
    });
    const pks = createPksDirectory({ "reseller-ok": [ACTIVE_PKS] });
    const service = new ResellerComplianceService(
      repository,
      pks,
      createSettings(false),
    );

    const result = await service.listResellersWithCompliance({
      tenantId: "tenant-1",
      page: 2,
      limit: 10,
    });

    expect(repository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", skip: 10, take: 10 }),
    );
    expect(pks.listContractsByReseller).toHaveBeenCalledTimes(1);
    expect(pks.listContractsByReseller).toHaveBeenCalledWith("tenant-1", [
      "reseller-ok",
      "reseller-bad",
    ]);
    expect(result.items[0].compliance).toMatchObject({
      isCompliant: true,
      pks: { status: "ACTIVE", documentId: "doc-1", daysLeft: 365 },
    });
    expect(result.items[1].compliance).toMatchObject({
      isCompliant: false,
      pks: { status: "NONE" },
    });
    expect(result.items[1].compliance.issueLabels).toContain("NIB belum diisi");
  });

  it("detail reseller null bila tidak ada di tenant", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(null);
    const service = new ResellerComplianceService(
      repository,
      createPksDirectory({}),
      createSettings(false),
    );

    expect(await service.getResellerWithCompliance("tenant-1", "x")).toBeNull();
  });

  it("pengaturan mati: reseller tidak patuh tetap boleh menerima pelanggan baru", async () => {
    const settings = createSettings(false);
    const pks = createPksDirectory({});
    const service = new ResellerComplianceService(repository, pks, settings);

    await expect(
      service.assertCanAcceptNewCustomer("tenant-1", NON_COMPLIANT),
    ).resolves.toBeUndefined();
    expect(pks.listContractsByReseller).not.toHaveBeenCalled();
  });

  it("pengaturan aktif: reseller tidak patuh ditolak 400 dengan rincian", async () => {
    const service = new ResellerComplianceService(
      repository,
      createPksDirectory({}),
      createSettings(true),
    );

    await expect(
      service.assertCanAcceptNewCustomer("tenant-1", NON_COMPLIANT),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(
        /Reseller Liar belum memenuhi kepatuhan.*belum ada PKS aktif/,
      ),
    });
  });

  it("pengaturan aktif: reseller patuh diterima", async () => {
    const service = new ResellerComplianceService(
      repository,
      createPksDirectory({ "reseller-ok": [ACTIVE_PKS] }),
      createSettings(true),
    );

    await expect(
      service.assertCanAcceptNewCustomer("tenant-1", COMPLIANT),
    ).resolves.toBeUndefined();
  });

  it("tanpa tenant gerbang dilewati", async () => {
    const settings = createSettings(true);
    const service = new ResellerComplianceService(
      repository,
      createPksDirectory({}),
      settings,
    );

    await service.assertCanAcceptNewCustomer(null, NON_COMPLIANT);
    expect(settings.isComplianceRequired).not.toHaveBeenCalled();
  });

  it("membaca dan menyimpan pengaturan per tenant", async () => {
    const settings = createSettings(false);
    const service = new ResellerComplianceService(
      repository,
      createPksDirectory({}),
      settings,
    );

    expect(await service.getComplianceSetting("tenant-1")).toEqual({
      isComplianceRequired: false,
      isSettlementSeparateApproverRequired: false,
    });
    vi.mocked(settings.isComplianceRequired).mockResolvedValueOnce(true);
    expect(
      await service.updateComplianceSetting("tenant-1", {
        isComplianceRequired: true,
      }),
    ).toEqual({
      isComplianceRequired: true,
      isSettlementSeparateApproverRequired: false,
    });
    expect(settings.setComplianceRequired).toHaveBeenCalledWith(
      "tenant-1",
      true,
    );
    expect(
      settings.setSettlementSeparateApproverRequired,
    ).not.toHaveBeenCalled();
  });

  it("hanya menyimpan sakelar pemisahan tugas bila hanya itu yang dikirim", async () => {
    const settings = createSettings(false);
    const service = new ResellerComplianceService(
      repository,
      createPksDirectory({}),
      settings,
    );
    vi.mocked(
      settings.isSettlementSeparateApproverRequired,
    ).mockResolvedValueOnce(true);

    expect(
      await service.updateComplianceSetting("tenant-1", {
        isSettlementSeparateApproverRequired: true,
      }),
    ).toEqual({
      isComplianceRequired: false,
      isSettlementSeparateApproverRequired: true,
    });
    expect(settings.setSettlementSeparateApproverRequired).toHaveBeenCalledWith(
      "tenant-1",
      true,
    );
    expect(settings.setComplianceRequired).not.toHaveBeenCalled();
  });
});

describe("ResellerCustomerRelationService — status kemitraan & gerbang kepatuhan", () => {
  let repository: IResellerRepository;
  const gate = { assertCanAcceptNewCustomer: vi.fn() };

  beforeEach(() => {
    repository = createResellerRepositoryMock();
    gate.assertCanAcceptNewCustomer.mockReset().mockResolvedValue(undefined);
  });

  it.each([
    ["SUSPENDED", /ditangguhkan/],
    ["TERMINATED", /diakhiri/],
    ["INACTIVE", /Reseller tidak aktif/],
  ] as const)(
    "reseller %s tidak bisa menerima pelanggan",
    async (status, message) => {
      vi.mocked(repository.findById).mockResolvedValueOnce(
        buildReseller({ status }),
      );
      const service = new ResellerCustomerRelationService(repository, gate);

      await expect(
        service.validateCustomerRelation({
          tenantId: "tenant-1",
          resellerId: "reseller-1",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(message),
      });
      expect(gate.assertCanAcceptNewCustomer).not.toHaveBeenCalled();
    },
  );

  it("pelanggan baru ke reseller memicu gerbang kepatuhan", async () => {
    const reseller = buildReseller();
    vi.mocked(repository.findById).mockResolvedValueOnce(reseller);
    const service = new ResellerCustomerRelationService(repository, gate);

    await service.validateCustomerRelation({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
    });

    expect(gate.assertCanAcceptNewCustomer).toHaveBeenCalledWith(
      "tenant-1",
      reseller,
    );
  });

  it("pelanggan lama yang hanya ganti outlet tidak diperiksa kepatuhannya", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());
    vi.mocked(repository.findOutletById).mockResolvedValueOnce({
      id: "outlet-1",
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      code: "O-1",
      name: "Outlet",
      phone: null,
      address: null,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    const service = new ResellerCustomerRelationService(repository, gate);

    await service.validateCustomerRelation({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      resellerOutletId: "outlet-1",
      currentResellerId: "reseller-1",
    });

    expect(gate.assertCanAcceptNewCustomer).not.toHaveBeenCalled();
  });

  it.each(["SUSPENDED", "TERMINATED", "INACTIVE"] as const)(
    "pelanggan lama reseller %s boleh pindah outlet di reseller yang sama",
    async (status) => {
      vi.mocked(repository.findById).mockResolvedValueOnce(
        buildReseller({ status }),
      );
      vi.mocked(repository.findOutletById).mockResolvedValueOnce({
        id: "outlet-2",
        tenantId: "tenant-1",
        resellerId: "reseller-1",
        code: "O-2",
        name: "Outlet 2",
        phone: null,
        address: null,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      const service = new ResellerCustomerRelationService(repository, gate);

      await expect(
        service.validateCustomerRelation({
          tenantId: "tenant-1",
          resellerId: "reseller-1",
          resellerOutletId: "outlet-2",
          currentResellerId: "reseller-1",
        }),
      ).resolves.toEqual({
        resellerId: "reseller-1",
        resellerOutletId: "outlet-2",
      });
      expect(gate.assertCanAcceptNewCustomer).not.toHaveBeenCalled();
    },
  );

  it("pindah outlet di reseller yang sama tetap menolak outlet nonaktif", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(
      buildReseller({ status: "SUSPENDED" }),
    );
    vi.mocked(repository.findOutletById).mockResolvedValueOnce({
      id: "outlet-2",
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      code: "O-2",
      name: "Outlet 2",
      phone: null,
      address: null,
      status: "INACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    const service = new ResellerCustomerRelationService(repository, gate);

    await expect(
      service.validateCustomerRelation({
        tenantId: "tenant-1",
        resellerId: "reseller-1",
        resellerOutletId: "outlet-2",
        currentResellerId: "reseller-1",
      }),
    ).rejects.toThrow(/Outlet reseller tidak aktif/);
  });

  it("penolakan gerbang diteruskan ke pemanggil", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());
    gate.assertCanAcceptNewCustomer.mockRejectedValueOnce(
      new Error("belum patuh"),
    );
    const service = new ResellerCustomerRelationService(repository, gate);

    await expect(
      service.validateCustomerRelation({
        tenantId: "tenant-1",
        resellerId: "reseller-1",
        currentResellerId: "reseller-lain",
      }),
    ).rejects.toThrow("belum patuh");
  });
});
