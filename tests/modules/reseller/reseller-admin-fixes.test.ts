import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";
import type { IResellerRepository } from "@/modules/reseller/domain/ports/IResellerRepository";
import { ResellerCustomerRelationService } from "@/modules/reseller/services/ResellerCustomerRelationService";
import { ResellerOutletService } from "@/modules/reseller/services/ResellerOutletService";
import { ResellerPricingService } from "@/modules/reseller/services/ResellerPricingService";
import { ResellerService } from "@/modules/reseller/services/ResellerService";

import {
  buildOutlet,
  buildReseller,
  createResellerRepositoryMock,
} from "./reseller-fixtures";

const DELETED_AT = new Date("2026-08-01T00:00:00.000Z");

let repository: IResellerRepository;

beforeEach(() => {
  repository = createResellerRepositoryMock();
});

describe("ResellerOutletService — outlet nonaktif tetap bisa dikelola", () => {
  let service: ResellerOutletService;

  beforeEach(() => {
    service = new ResellerOutletService(repository);
  });

  it("mengaktifkan kembali outlet INACTIVE", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());
    vi.mocked(repository.findOutletById).mockResolvedValueOnce(
      buildOutlet({ status: "INACTIVE" }),
    );
    vi.mocked(repository.updateOutlet).mockResolvedValueOnce(buildOutlet());

    const result = await service.updateOutlet(
      "tenant-1",
      "reseller-1",
      "outlet-1",
      { status: "ACTIVE" },
    );

    expect(result.status).toBe("ACTIVE");
    expect(repository.updateOutlet).toHaveBeenCalledWith(
      "tenant-1",
      "outlet-1",
      expect.objectContaining({ status: "ACTIVE" }),
    );
  });

  it("menghapus outlet INACTIVE", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());
    vi.mocked(repository.findOutletById).mockResolvedValueOnce(
      buildOutlet({ status: "INACTIVE" }),
    );

    await service.deleteOutlet("tenant-1", "reseller-1", "outlet-1");

    expect(repository.softDeleteOutlet).toHaveBeenCalledWith(
      "tenant-1",
      "outlet-1",
    );
  });

  it("meneruskan status INACTIVE yang dipilih saat membuat outlet", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());
    vi.mocked(repository.findOutletByCode).mockResolvedValueOnce(null);
    vi.mocked(repository.createOutlet).mockResolvedValueOnce(
      buildOutlet({ status: "INACTIVE" }),
    );

    await service.createOutlet("tenant-1", "reseller-1", {
      code: "OUT-001",
      name: "Outlet",
      status: "INACTIVE",
    });

    expect(repository.createOutlet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "INACTIVE" }),
    );
  });

  it("menjelaskan 409 saat kode outlet dipegang outlet yang sudah dihapus", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());
    vi.mocked(repository.findOutletByCode).mockResolvedValueOnce(
      buildOutlet({ deletedAt: DELETED_AT, status: "INACTIVE" }),
    );

    const error = await service
      .createOutlet("tenant-1", "reseller-1", { code: "OUT-001", name: "O" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ statusCode: 409 });
    expect((error as Error).message).toMatch(/dihapus/);
    expect(repository.createOutlet).not.toHaveBeenCalled();
  });

  it("menolak mengganti kode outlet ke kode yang sudah dipakai", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());
    vi.mocked(repository.findOutletById).mockResolvedValueOnce(buildOutlet());
    vi.mocked(repository.findOutletByCode).mockResolvedValueOnce(
      buildOutlet({ id: "outlet-2", code: "OUT-002" }),
    );

    await expect(
      service.updateOutlet("tenant-1", "reseller-1", "outlet-1", {
        code: "OUT-002",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repository.updateOutlet).not.toHaveBeenCalled();
  });
});

describe("ResellerOutletService — reseller yang sudah dihapus", () => {
  let service: ResellerOutletService;

  beforeEach(() => {
    service = new ResellerOutletService(repository);
    // findById menyaring deletedAt: reseller terhapus tampak sebagai null,
    // sementara outlet-nya tidak ikut di-soft-delete dan masih ditemukan.
    vi.mocked(repository.findById).mockResolvedValue(null);
    vi.mocked(repository.findOutletById).mockResolvedValue(
      buildOutlet({ status: "INACTIVE" }),
    );
  });

  it("menolak mengaktifkan outlet milik reseller terhapus dengan 404", async () => {
    await expect(
      service.updateOutlet("tenant-1", "reseller-1", "outlet-1", {
        status: "ACTIVE",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(repository.updateOutlet).not.toHaveBeenCalled();
  });

  it("menolak menghapus outlet milik reseller terhapus dengan 404", async () => {
    await expect(
      service.deleteOutlet("tenant-1", "reseller-1", "outlet-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(repository.softDeleteOutlet).not.toHaveBeenCalled();
  });

  it("detail outlet milik reseller terhapus tidak ditemukan", async () => {
    await expect(
      service.getOutletById("tenant-1", "reseller-1", "outlet-1"),
    ).resolves.toBeNull();
  });
});

describe("ResellerService — status create, kode terhapus, typed error", () => {
  let service: ResellerService;

  beforeEach(() => {
    service = new ResellerService(repository);
  });

  it("menyimpan status INACTIVE yang dipilih saat membuat reseller", async () => {
    vi.mocked(repository.findByCode).mockResolvedValueOnce(null);
    vi.mocked(repository.create).mockResolvedValueOnce(
      buildReseller({ status: "INACTIVE" }),
    );

    await service.createReseller({
      tenantId: "tenant-1",
      code: "RSL-001",
      name: "R",
      status: "INACTIVE",
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "INACTIVE" }),
    );
  });

  it("menjelaskan 409 saat kode reseller dipegang reseller yang sudah dihapus", async () => {
    vi.mocked(repository.findByCode).mockResolvedValueOnce(
      buildReseller({ deletedAt: DELETED_AT, status: "INACTIVE" }),
    );

    const error = await service
      .createReseller({ tenantId: "tenant-1", code: "RSL-001", name: "R" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ statusCode: 409 });
    expect((error as Error).message).toMatch(/dihapus/);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("melempar 404 bertipe saat reseller yang diedit tidak ada", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(null);

    await expect(
      service.updateReseller("tenant-1", "missing", { name: "X" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("menyimpan email/phone kosong sebagai null saat update", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());
    vi.mocked(repository.update).mockResolvedValueOnce(buildReseller());

    await service.updateReseller("tenant-1", "reseller-1", {
      email: "",
      phone: " ",
    });

    expect(repository.update).toHaveBeenCalledWith(
      "tenant-1",
      "reseller-1",
      expect.objectContaining({ email: null, phone: null }),
    );
  });
});

describe("ResellerCustomerRelationService — pelanggaran relasi = 400", () => {
  let service: ResellerCustomerRelationService;

  beforeEach(() => {
    service = new ResellerCustomerRelationService(repository, {
      assertCanAcceptNewCustomer: vi.fn().mockResolvedValue(undefined),
    });
  });

  async function captureError(
    input: Parameters<
      ResellerCustomerRelationService["validateCustomerRelation"]
    >[0],
  ): Promise<unknown> {
    return service
      .validateCustomerRelation(input)
      .then((): unknown => null)
      .catch((caught: unknown) => caught);
  }

  it("reseller tidak aktif dibalas 400, bukan Error biasa yang menjadi 500", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(
      buildReseller({ status: "INACTIVE" }),
    );

    const error = await captureError({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
    });

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ statusCode: 400 });
    expect((error as Error).message).toMatch(/tidak aktif/);
  });

  it("reseller tidak ada dibalas 400", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(null);

    const error = await captureError({
      tenantId: "tenant-1",
      resellerId: "missing",
    });

    expect(error).toMatchObject({ statusCode: 400 });
  });

  it("outlet milik reseller lain dibalas 400", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());
    vi.mocked(repository.findOutletById).mockResolvedValueOnce(
      buildOutlet({ resellerId: "reseller-other" }),
    );

    const error = await captureError({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      resellerOutletId: "outlet-1",
    });

    expect(error).toMatchObject({ statusCode: 400 });
  });

  it("outlet nonaktif dibalas 400", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());
    vi.mocked(repository.findOutletById).mockResolvedValueOnce(
      buildOutlet({ status: "INACTIVE" }),
    );

    const error = await captureError({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      resellerOutletId: "outlet-1",
    });

    expect(error).toMatchObject({ statusCode: 400 });
  });
});

describe("ResellerPricingService — paket wajib milik tenant yang sama", () => {
  let service: ResellerPricingService;

  beforeEach(() => {
    service = new ResellerPricingService(repository);
  });

  it("menolak hargaPaketId tenant lain/tidak dikenal dengan 400 tanpa menulis", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());
    vi.mocked(repository.findBasePackagePrice).mockResolvedValueOnce(null);

    const error = await service
      .upsertPackagePrice({
        tenantId: "tenant-1",
        resellerId: "reseller-1",
        hargaPaketId: "pkg-tenant-lain",
        price: 1000,
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ statusCode: 400 });
    expect(repository.findBasePackagePrice).toHaveBeenCalledWith(
      "tenant-1",
      "pkg-tenant-lain",
    );
    expect(repository.upsertPackagePrice).not.toHaveBeenCalled();
  });

  it("menyimpan override bila paket milik tenant", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(buildReseller());
    vi.mocked(repository.findBasePackagePrice).mockResolvedValueOnce(150000);
    vi.mocked(repository.upsertPackagePrice).mockResolvedValueOnce({
      id: "price-1",
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      hargaPaketId: "pkg-1",
      price: 120000,
      status: "ACTIVE",
      startsAt: new Date("2026-07-08T00:00:00.000Z"),
      endsAt: null,
      createdAt: new Date("2026-07-08T00:00:00.000Z"),
      updatedAt: new Date("2026-07-08T00:00:00.000Z"),
      deletedAt: null,
    });

    await service.upsertPackagePrice({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      hargaPaketId: "pkg-1",
      price: 120000,
    });

    expect(repository.upsertPackagePrice).toHaveBeenCalledOnce();
  });

  it("reseller tidak ada dibalas 404", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(null);

    await expect(
      service.upsertPackagePrice({
        tenantId: "tenant-1",
        resellerId: "missing",
        hargaPaketId: "pkg-1",
        price: 1000,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
