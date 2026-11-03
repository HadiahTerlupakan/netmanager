import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IResellerRepository } from "@/modules/reseller/domain/ports/IResellerRepository";
import { ResellerService } from "@/modules/reseller/services/ResellerService";
import {
  resolveLicenseData,
  resolveStatusData,
} from "@/modules/reseller/services/reseller-partnership-rules";
import {
  buildReseller,
  createResellerRepositoryMock,
} from "./reseller-fixtures";

const NOW = new Date("2026-11-03T08:00:00.000Z");
const ACTOR = { actorId: "admin-1", now: NOW };
const VERIFIED_AT = new Date("2026-10-01T00:00:00.000Z");
const LICENSED = {
  nib: "1234567890123",
  kbliCode: "61994",
  standardCertificateNumber: "SS-001",
  licenseVerifiedAt: VERIFIED_AT,
  licenseVerifiedById: "admin-0",
};

describe("resolveStatusData", () => {
  it("mencatat pelaku, waktu, dan alasan saat status berubah", () => {
    expect(
      resolveStatusData(
        { status: "SUSPENDED", statusReason: "  Tunggakan PKS  " },
        "ACTIVE",
        ACTOR,
      ),
    ).toEqual({
      status: "SUSPENDED",
      statusReason: "Tunggakan PKS",
      statusChangedAt: NOW,
      statusChangedById: "admin-1",
    });
  });

  it.each(["SUSPENDED", "TERMINATED"] as const)(
    "menolak %s tanpa alasan",
    (status) => {
      expect(() =>
        resolveStatusData({ status, statusReason: " " }, "ACTIVE", ACTOR),
      ).toThrow(/Alasan wajib diisi/);
    },
  );

  it("tidak menyentuh jejak bila status tidak berubah", () => {
    expect(
      resolveStatusData({ status: "SUSPENDED" }, "SUSPENDED", ACTOR),
    ).toEqual({});
  });

  it("menolak pengosongan alasan reseller yang sedang ditangguhkan", () => {
    expect(() =>
      resolveStatusData({ statusReason: "" }, "SUSPENDED", ACTOR),
    ).toThrow(/Alasan wajib diisi/);
  });

  it("mengaktifkan kembali tanpa alasan diperbolehkan", () => {
    expect(
      resolveStatusData({ status: "ACTIVE" }, "SUSPENDED", ACTOR),
    ).toMatchObject({
      status: "ACTIVE",
      statusReason: null,
      statusChangedById: "admin-1",
    });
  });

  it("mengaktifkan kembali reseller TERMINATED wajib beralasan", () => {
    expect(() =>
      resolveStatusData({ status: "ACTIVE" }, "TERMINATED", ACTOR),
    ).toThrow(/Alasan wajib diisi/);
    expect(() =>
      resolveStatusData(
        { status: "INACTIVE", statusReason: "" },
        "TERMINATED",
        ACTOR,
      ),
    ).toThrow(/Alasan wajib diisi/);
  });

  it("mengaktifkan kembali reseller TERMINATED dengan alasan dicatat", () => {
    expect(
      resolveStatusData(
        { status: "ACTIVE", statusReason: "PKS baru ditandatangani" },
        "TERMINATED",
        ACTOR,
      ),
    ).toEqual({
      status: "ACTIVE",
      statusReason: "PKS baru ditandatangani",
      statusChangedAt: NOW,
      statusChangedById: "admin-1",
    });
  });

  it("reseller baru tanpa status menjadi ACTIVE", () => {
    expect(resolveStatusData({}, null, ACTOR)).toMatchObject({
      status: "ACTIVE",
    });
  });
});

describe("resolveLicenseData", () => {
  it("menandai terverifikasi bila data lengkap", () => {
    expect(
      resolveLicenseData(
        {
          nib: "1234567890123",
          kbliCode: "61994",
          standardCertificateNumber: "SS-001",
          licenseVerified: true,
        },
        null,
        ACTOR,
      ),
    ).toMatchObject({
      nib: "1234567890123",
      licenseVerifiedAt: NOW,
      licenseVerifiedById: "admin-1",
    });
  });

  it("menolak verifikasi bila data izin belum lengkap", () => {
    expect(() =>
      resolveLicenseData(
        { nib: "1234567890123", licenseVerified: true },
        null,
        ACTOR,
      ),
    ).toThrow(/Lengkapi NIB/);
  });

  it("mempertahankan waktu verifikasi lama bila data tidak berubah", () => {
    const result = resolveLicenseData(
      { ...LICENSED, licenseVerified: true },
      LICENSED,
      ACTOR,
    );
    expect(result).not.toHaveProperty("licenseVerifiedAt");
    expect(result).not.toHaveProperty("nib");
  });

  it("menggugurkan verifikasi bila NIB berubah tanpa verifikasi ulang", () => {
    expect(
      resolveLicenseData({ nib: "9999999999999" }, LICENSED, ACTOR),
    ).toMatchObject({
      nib: "9999999999999",
      licenseVerifiedAt: null,
      licenseVerifiedById: null,
    });
  });

  it("mencabut verifikasi bila licenseVerified false", () => {
    expect(
      resolveLicenseData({ licenseVerified: false }, LICENSED, ACTOR),
    ).toMatchObject({ licenseVerifiedAt: null, licenseVerifiedById: null });
  });
});

describe("ResellerService.updateReseller — izin dan status kemitraan", () => {
  let repository: IResellerRepository;
  let service: ResellerService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    repository = createResellerRepositoryMock();
    service = new ResellerService(repository);
    vi.mocked(repository.update).mockImplementation(
      async (_tenant, _id, data) => buildReseller(data as never),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("menangguhkan reseller atas nama admin yang mengubah", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());

    await service.updateReseller(
      "tenant-1",
      "reseller-1",
      { status: "SUSPENDED", statusReason: "Melanggar PKS" },
      "admin-1",
    );

    expect(repository.update).toHaveBeenCalledWith(
      "tenant-1",
      "reseller-1",
      expect.objectContaining({
        status: "SUSPENDED",
        statusReason: "Melanggar PKS",
        statusChangedAt: NOW,
        statusChangedById: "admin-1",
      }),
    );
  });

  it("menolak TERMINATED tanpa alasan sebelum menulis", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());

    await expect(
      service.updateReseller("tenant-1", "reseller-1", {
        status: "TERMINATED",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("mengembalikan data izin di DTO", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());

    const result = await service.updateReseller(
      "tenant-1",
      "reseller-1",
      {
        legalName: "PT Mitra Net",
        nib: "1234567890123",
        kbliCode: "61994",
        standardCertificateNumber: "SS-001",
        brandName: "MitraNet",
        licenseVerified: true,
      },
      "admin-1",
    );

    expect(result).toMatchObject({
      legalName: "PT Mitra Net",
      nib: "1234567890123",
      brandName: "MitraNet",
      licenseVerifiedAt: NOW.toISOString(),
      licenseVerifiedById: "admin-1",
    });
  });
});

describe("ResellerService.createReseller — jejak awal", () => {
  it("mencatat pembuat sebagai verifikator izin", async () => {
    const repository = createResellerRepositoryMock();
    vi.mocked(repository.findByCode).mockResolvedValueOnce(null);
    vi.mocked(repository.create).mockImplementation(async (data) =>
      buildReseller(data as never),
    );

    await new ResellerService(repository).createReseller({
      tenantId: "tenant-1",
      code: "R-1",
      name: "Reseller",
      nib: "1234567890123",
      kbliCode: "61994",
      standardCertificateNumber: "SS-001",
      licenseVerified: true,
      actorId: "admin-9",
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ACTIVE",
        licenseVerifiedById: "admin-9",
        statusChangedById: "admin-9",
      }),
    );
  });
});
