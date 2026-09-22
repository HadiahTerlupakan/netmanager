import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Service prospek adalah satu-satunya penjaga aturan funnel. Kalau perubahan
 * status bisa menembusnya, prospek bisa melompat dari BARU ke DEAL tanpa
 * pernah dihubungi dan laporan konversi jadi menyesatkan.
 */

import { ProspekService } from "@/modules/presurvei/services/ProspekService";
import type { IProspekRepository } from "@/modules/presurvei/domain/ports/IProspekRepository";
import type { ProspekEntity } from "@/modules/presurvei/domain/entities/Prospek";

const prospek = (over: Partial<ProspekEntity> = {}): ProspekEntity => ({
  id: "prospek-1",
  nama: "Budi",
  noTelp: "081234567890",
  email: null,
  alamat: "Jl. Merdeka 10",
  latitude: null,
  longitude: null,
  shareloc: null,
  sumber: "LAPANGAN",
  iklanId: null,
  registrationId: null,
  referralNama: null,
  status: "BARU",
  pemilikId: "user-1",
  paketDiminati: null,
  catatan: null,
  canvasingId: null,
  konversiAt: null,
  siteId: null,
  tenantId: "tenant-1",
  createdAt: new Date("2026-09-22T00:00:00.000Z"),
  updatedAt: new Date("2026-09-22T00:00:00.000Z"),
  ...over,
});

const bangunRepository = (): IProspekRepository => ({
  findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  findById: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  update: vi.fn(),
});

describe("ProspekService.detail", () => {
  let repository: IProspekRepository;

  beforeEach(() => {
    repository = bangunRepository();
  });

  it("melempar 404 saat prospek tidak ditemukan", async () => {
    const service = new ProspekService(repository);

    await expect(service.detail("tidak-ada")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  it("mengembalikan prospek yang ditemukan", async () => {
    vi.mocked(repository.findById).mockResolvedValue(prospek());
    const service = new ProspekService(repository);

    const hasil = await service.detail("prospek-1");

    expect(hasil.id).toBe("prospek-1");
  });
});

describe("ProspekService.ubah", () => {
  let repository: IProspekRepository;

  beforeEach(() => {
    repository = bangunRepository();
  });

  it("menolak lompatan status yang melanggar aturan funnel", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      prospek({ status: "BARU" }),
    );
    const service = new ProspekService(repository);

    await expect(
      service.ubah("prospek-1", { status: "DEAL" }),
    ).rejects.toMatchObject({ statusCode: 409, code: "INVALID_STATE" });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("mengizinkan perpindahan status satu langkah", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      prospek({ status: "BARU" }),
    );
    vi.mocked(repository.update).mockResolvedValue(
      prospek({ status: "DIHUBUNGI" }),
    );
    const service = new ProspekService(repository);

    const hasil = await service.ubah("prospek-1", { status: "DIHUBUNGI" });

    expect(hasil.status).toBe("DIHUBUNGI");
    expect(repository.update).toHaveBeenCalledWith("prospek-1", {
      status: "DIHUBUNGI",
    });
  });

  it("melewati pemeriksaan status saat yang diubah hanya data kontak", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      prospek({ status: "DEAL" }),
    );
    vi.mocked(repository.update).mockResolvedValue(
      prospek({ status: "DEAL", catatan: "sudah dihubungi ulang" }),
    );
    const service = new ProspekService(repository);

    await service.ubah("prospek-1", { catatan: "sudah dihubungi ulang" });

    expect(repository.update).toHaveBeenCalledOnce();
  });

  it("melempar 404 saat prospek yang diubah tidak ada", async () => {
    const service = new ProspekService(repository);

    await expect(
      service.ubah("tidak-ada", { catatan: "apa pun" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("ProspekService.buat", () => {
  it("meneruskan masukan apa adanya ke repository", async () => {
    const repository = bangunRepository();
    vi.mocked(repository.create).mockResolvedValue(prospek());
    const service = new ProspekService(repository);

    await service.buat({
      nama: "Budi",
      noTelp: "081234567890",
      alamat: "Jl. Merdeka 10",
      sumber: "WALK_IN",
      pemilikId: "user-1",
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ sumber: "WALK_IN" }),
    );
  });
});
