import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

/**
 * Promosi menyentuh dua modul sekaligus, jadi urutannya penting: canvasing
 * dibuat lebih dulu, baru prospek ditandai. Bila urutannya dibalik dan
 * pembuatan canvasing gagal, prospek terlanjur tercatat terkonversi ke
 * canvasing yang tidak pernah ada.
 */

import { ProspekKonversiService } from "@/modules/presurvei/services/ProspekKonversiService";
import type { IProspekRepository } from "@/modules/presurvei/domain/ports/IProspekRepository";
import type { IKegiatanRepository } from "@/modules/presurvei/domain/ports/IKegiatanRepository";
import type { ProspekEntity } from "@/modules/presurvei/domain/entities/Prospek";
import type { KegiatanEntity } from "@/modules/presurvei/domain/entities/Kegiatan";
import type { CreateCanvasingInput } from "@/modules/marketing";

/**
 * Signature tiruan untuk parameter ketiga konstruktor `ProspekKonversiService`.
 *
 * `vi.fn()` tanpa argumen generik di sini akan resolve ke `Mock<Procedure |
 * Constructable>` (lewat `ReturnType<typeof vi.fn>`), yang kehilangan call
 * signature-nya sendiri sehingga tidak cocok dipakai sebagai `PembuatCanvasing`.
 * Mengetik eksplisit menghindarinya tanpa melonggarkan jadi `any`.
 */
type BuatCanvasingTiruan = (
  input: CreateCanvasingInput,
) => Promise<{ id: string }>;

const WAKTU = new Date("2026-09-23T00:00:00.000Z");

const prospek = (over: Partial<ProspekEntity> = {}): ProspekEntity =>
  ({
    id: "prospek-1",
    nama: "Budi",
    noTelp: "081234567890",
    email: null,
    alamat: "Jl. Merdeka 10",
    latitude: -6.2,
    longitude: 106.8,
    shareloc: null,
    sumber: "LAPANGAN",
    iklanId: null,
    registrationId: null,
    referralNama: null,
    status: "DEAL",
    pemilikId: "user-1",
    paketDiminati: null,
    catatan: null,
    canvasingId: null,
    konversiAt: null,
    siteId: null,
    tenantId: "tenant-1",
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...over,
  }) as ProspekEntity;

const kegiatanSurvei = (over: Partial<KegiatanEntity> = {}): KegiatanEntity =>
  ({
    id: "kegiatan-1",
    jenis: "SURVEI_LOKASI",
    userId: "user-1",
    prospekId: "prospek-1",
    iklanId: null,
    waktuMulai: WAKTU,
    waktuSelesai: null,
    latitude: -6.2,
    longitude: 106.8,
    alamatDikunjungi: "Jl. Merdeka 10",
    ditemuiNama: "Budi",
    hasil: "DEAL",
    catatan: null,
    fotoUrls: ["https://contoh.id/rumah.webp"],
    odpTerdekat: "ODP-12",
    estimasiKabelMeter: 120,
    catatanTeknis: null,
    siteId: null,
    tenantId: "tenant-1",
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...over,
  }) as KegiatanEntity;

const bangunProspekRepo = (): IProspekRepository => ({
  findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  findById: vi.fn().mockResolvedValue(prospek()),
  findByNoTelp: vi.fn().mockResolvedValue([]),
  findByRegistrationId: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  update: vi.fn().mockResolvedValue(prospek({ canvasingId: "canvasing-1" })),
});

const bangunKegiatanRepo = (): IKegiatanRepository => ({
  findMany: vi.fn().mockResolvedValue({ items: [kegiatanSurvei()], total: 1 }),
  findById: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  createDenganProspek: vi.fn(),
});

const masukan = { noKtp: "3201234567890001", paket: "HOME_20MBPS" };

describe("ProspekKonversiService.jadikanCanvasing", () => {
  let prospekRepo: IProspekRepository;
  let kegiatanRepo: IKegiatanRepository;
  let buatCanvasing: Mock<BuatCanvasingTiruan>;

  beforeEach(() => {
    prospekRepo = bangunProspekRepo();
    kegiatanRepo = bangunKegiatanRepo();
    buatCanvasing = vi
      .fn<BuatCanvasingTiruan>()
      .mockResolvedValue({ id: "canvasing-1" });
  });

  const service = () =>
    new ProspekKonversiService(prospekRepo, kegiatanRepo, buatCanvasing);

  it("menolak prospek yang belum DEAL", async () => {
    vi.mocked(prospekRepo.findById).mockResolvedValue(
      prospek({ status: "NEGOSIASI" }),
    );

    await expect(
      service().jadikanCanvasing("prospek-1", masukan),
    ).rejects.toMatchObject({ statusCode: 409, code: "INVALID_STATE" });

    expect(buatCanvasing).not.toHaveBeenCalled();
  });

  it("menolak prospek yang sudah pernah dipromosikan", async () => {
    vi.mocked(prospekRepo.findById).mockResolvedValue(
      prospek({ canvasingId: "canvasing-lama" }),
    );

    await expect(
      service().jadikanCanvasing("prospek-1", masukan),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(buatCanvasing).not.toHaveBeenCalled();
  });

  it("memakai data teknis dari kegiatan survei terbaru", async () => {
    await service().jadikanCanvasing("prospek-1", masukan);

    expect(buatCanvasing).toHaveBeenCalledWith(
      expect.objectContaining({ odp: "ODP-12", kabel: 120 }),
    );
  });

  it("mengutamakan nilai dari body di atas data kegiatan", async () => {
    await service().jadikanCanvasing("prospek-1", {
      ...masukan,
      kabel: 200,
      odp: "ODP-99",
    });

    expect(buatCanvasing).toHaveBeenCalledWith(
      expect.objectContaining({ odp: "ODP-99", kabel: 200 }),
    );
  });

  it("memindahkan identitas prospek ke canvasing", async () => {
    await service().jadikanCanvasing("prospek-1", masukan);

    expect(buatCanvasing).toHaveBeenCalledWith(
      expect.objectContaining({
        nama: "Budi",
        noTelpon: "081234567890",
        alamat: "Jl. Merdeka 10",
        latitude: -6.2,
        longitude: 106.8,
        noKtp: "3201234567890001",
        paket: "HOME_20MBPS",
        salesId: "user-1",
      }),
    );
  });

  it("menandai prospek setelah canvasing terbentuk, bukan sebelumnya", async () => {
    const urutan: string[] = [];
    buatCanvasing.mockImplementation(async () => {
      urutan.push("canvasing");
      return { id: "canvasing-1" };
    });
    vi.mocked(prospekRepo.update).mockImplementation(async () => {
      urutan.push("tandai");
      return prospek({ canvasingId: "canvasing-1" });
    });

    await service().jadikanCanvasing("prospek-1", masukan);

    expect(urutan).toEqual(["canvasing", "tandai"]);
  });

  it("tidak menandai prospek bila pembuatan canvasing gagal", async () => {
    buatCanvasing.mockRejectedValue(new Error("canvasing gagal"));

    await expect(
      service().jadikanCanvasing("prospek-1", masukan),
    ).rejects.toThrow();

    expect(prospekRepo.update).not.toHaveBeenCalled();
  });

  it("menghormati pembatasan kepemilikan", async () => {
    await expect(
      service().jadikanCanvasing("prospek-1", masukan, "sales-lain"),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(buatCanvasing).not.toHaveBeenCalled();
  });

  it("memakai kabel nol bila tidak ada kegiatan survei maupun nilai dari body", async () => {
    vi.mocked(kegiatanRepo.findMany).mockResolvedValue({ items: [], total: 0 });

    await service().jadikanCanvasing("prospek-1", masukan);

    expect(buatCanvasing).toHaveBeenCalledWith(
      expect.objectContaining({ kabel: 0, odp: null }),
    );
  });
});
