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

/** Signature tiruan untuk parameter keempat konstruktor (kompensasi hapus). */
type PenghapusCanvasingTiruan = (canvasingId: string) => Promise<void>;

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
  update: vi.fn(),
  tandaiKonversi: vi
    .fn()
    .mockResolvedValue(
      prospek({ canvasingId: "canvasing-1", konversiAt: WAKTU }),
    ),
  hitungBaruPerUser: vi.fn().mockResolvedValue({}),
  hitungKonversiPerUser: vi.fn().mockResolvedValue({}),
});

const bangunKegiatanRepo = (): IKegiatanRepository => ({
  findMany: vi.fn().mockResolvedValue({ items: [kegiatanSurvei()], total: 1 }),
  findById: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  createDenganProspek: vi.fn(),
  hitungPerUser: vi.fn().mockResolvedValue({}),
});

const masukan = { noKtp: "3201234567890001", paket: "HOME_20MBPS" };

describe("ProspekKonversiService.jadikanCanvasing", () => {
  let prospekRepo: IProspekRepository;
  let kegiatanRepo: IKegiatanRepository;
  let buatCanvasing: Mock<BuatCanvasingTiruan>;
  let hapusCanvasing: Mock<PenghapusCanvasingTiruan>;

  beforeEach(() => {
    prospekRepo = bangunProspekRepo();
    kegiatanRepo = bangunKegiatanRepo();
    buatCanvasing = vi
      .fn<BuatCanvasingTiruan>()
      .mockResolvedValue({ id: "canvasing-1" });
    hapusCanvasing = vi
      .fn<PenghapusCanvasingTiruan>()
      .mockResolvedValue(undefined);
  });

  const service = () =>
    new ProspekKonversiService(
      prospekRepo,
      kegiatanRepo,
      buatCanvasing,
      hapusCanvasing,
    );

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

  it("mencari survei terbaru milik prospek ini saja", async () => {
    // Tanpa filter prospekId, query menarik survei terbaru milik prospek mana
    // pun di tenant — lalu ODP dan estimasi kabel pelanggan lain tersalin ke
    // canvasing ini tanpa satu pun tanda di permukaan.
    await service().jadikanCanvasing("prospek-1", masukan);

    expect(kegiatanRepo.findMany).toHaveBeenCalledWith({
      prospekId: "prospek-1",
      jenis: "SURVEI_LOKASI",
      page: 1,
      limit: 1,
    });
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

  it("mengembalikan prospek dengan konversiAt terisi", async () => {
    // "Kapan prospek terkonversi" adalah inti task ini — tandaiKonversi kini
    // yang menentukan konversiAt (bukan payload dari service), jadi yang
    // diperiksa di sini adalah hasil akhirnya, bukan argumen pemanggilan.
    const hasil = await service().jadikanCanvasing("prospek-1", masukan);

    expect(hasil.prospek.konversiAt).toEqual(WAKTU);
  });

  it("menandai prospek setelah canvasing terbentuk, bukan sebelumnya", async () => {
    const urutan: string[] = [];
    buatCanvasing.mockImplementation(async () => {
      urutan.push("canvasing");
      return { id: "canvasing-1" };
    });
    vi.mocked(prospekRepo.tandaiKonversi).mockImplementation(async () => {
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

    expect(prospekRepo.tandaiKonversi).not.toHaveBeenCalled();
  });

  it("menghapus canvasing yang terlanjur dibuat saat penandaan prospek gagal", async () => {
    // Tanpa kompensasi, baris canvasing tertinggal berstatus PENDING: ia muncul
    // di daftar admin, bisa di-approve jadi work order, dan tidak bisa
    // ditemukan lagi dari sisi prospek karena penandaannya tidak pernah jadi.
    vi.mocked(prospekRepo.tandaiKonversi).mockRejectedValue(new Error("gagal"));

    await expect(
      service().jadikanCanvasing("prospek-1", masukan),
    ).rejects.toThrow();

    expect(hapusCanvasing).toHaveBeenCalledWith("canvasing-1");
  });

  it("menghapus canvasing dan menolak saat permintaan lain menang balapan", async () => {
    // `tandaiKonversi` mengembalikan null ketika prospek sudah punya
    // canvasingId — artinya permintaan kembar sudah menandainya lebih dulu.
    // Canvasing milik permintaan yang kalah harus ikut dibersihkan.
    vi.mocked(prospekRepo.tandaiKonversi).mockResolvedValue(null);

    await expect(
      service().jadikanCanvasing("prospek-1", masukan),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(hapusCanvasing).toHaveBeenCalledWith("canvasing-1");
  });

  it("menghormati pembatasan kepemilikan", async () => {
    await expect(
      service().jadikanCanvasing("prospek-1", masukan, "sales-lain"),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(buatCanvasing).not.toHaveBeenCalled();
  });

  it("memakai kabel bawaan bila tidak ada kegiatan survei maupun nilai dari body", async () => {
    // Bawaannya 1, bukan 0 — validator marketing menolak kabel < 1, jadi
    // bawaan yang tidak sah membuat baris ini sendiri tidak akan pernah
    // benar-benar terkirim ke buatCanvasing (lihat Perbaikan 3).
    vi.mocked(kegiatanRepo.findMany).mockResolvedValue({ items: [], total: 0 });

    await service().jadikanCanvasing("prospek-1", masukan);

    expect(buatCanvasing).toHaveBeenCalledWith(
      expect.objectContaining({ kabel: 1, odp: null }),
    );
  });

  it("memperlakukan estimasi kabel survei nol sebagai tak tercatat, jatuh ke bawaan", async () => {
    // Survei boleh mencatat 0 (`kegiatan.validator.ts`), canvasing menuntut
    // minimal 1. Dengan `??` polos, 0 lolos lalu ditolak validator marketing
    // — SETELAH prospek terlanjur dipindah ke DEAL. Nilai nol diperlakukan
    // sebagai survei yang tidak mencatat kabel.
    vi.mocked(kegiatanRepo.findMany).mockResolvedValue({
      items: [kegiatanSurvei({ estimasiKabelMeter: 0, odpTerdekat: "ODP-07" })],
      total: 1,
    });

    await service().jadikanCanvasing("prospek-1", masukan);

    expect(buatCanvasing).toHaveBeenCalledWith(
      expect.objectContaining({ kabel: 1, odp: "ODP-07" }),
    );
  });

  it("menolak kabel nol dari body, tidak menggantinya diam-diam", async () => {
    // Cabang `input.kabel ??`. Dengan `||`, nilai 0 jatuh ke estimasi survei
    // (kegiatanRepo bawaan mencatat estimasiKabelMeter: 120, angka yang sah)
    // atau bawaan — canvasing lahir dengan angka yang tidak pernah diminta
    // pemanggil, dan tidak ada yang tahu. Dengan `??` nilainya sampai ke
    // validator marketing dan ditolak terang-terangan.
    await expect(
      service().jadikanCanvasing("prospek-1", { ...masukan, kabel: 0 }),
    ).rejects.toThrow();

    expect(buatCanvasing).not.toHaveBeenCalled();
  });
});
