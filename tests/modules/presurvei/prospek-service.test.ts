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
  findByNoTelp: vi.fn().mockResolvedValue([]),
  findByRegistrationId: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  update: vi.fn(),
  tandaiKonversi: vi.fn(),
  hitungBaruPerUser: vi.fn().mockResolvedValue({}),
  hitungKonversiPerUser: vi.fn().mockResolvedValue({}),
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

  it("mengembalikan prospek saat pemilik wajibnya cocok", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      prospek({ pemilikId: "user-1" }),
    );
    const service = new ProspekService(repository);

    const hasil = await service.detail("prospek-1", "user-1");

    expect(hasil.id).toBe("prospek-1");
  });

  it("menolak 403 saat prospek milik sales lain", async () => {
    // Sales lapangan hanya memegang `m_presurvei:read`, tanpa `presurvei:read`.
    // Tanpa pengikat ini ia bisa membaca seluruh prospek tenant.
    vi.mocked(repository.findById).mockResolvedValue(
      prospek({ pemilikId: "user-lain" }),
    );
    const service = new ProspekService(repository);

    await expect(service.detail("prospek-1", "user-1")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });

  it("menolak 403 saat prospek belum punya pemilik", async () => {
    // Prospek tanpa pemilik ada di daftar "Belum ditugaskan" milik admin, bukan
    // milik sales mana pun — `null === "user-1"` harus tetap bernilai tolak.
    vi.mocked(repository.findById).mockResolvedValue(
      prospek({ pemilikId: null }),
    );
    const service = new ProspekService(repository);

    await expect(service.detail("prospek-1", "user-1")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });

  it("tidak membatasi kepemilikan saat pemilik wajib tidak diisi", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      prospek({ pemilikId: "user-lain" }),
    );
    const service = new ProspekService(repository);

    const hasil = await service.detail("prospek-1");

    expect(hasil.pemilikId).toBe("user-lain");
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

  it("menerima status yang sama dengan status saat ini sebagai update idempotent", async () => {
    // Tabel transisi tidak memuat perpindahan ke diri sendiri, jadi
    // isTransisiStatusSah("DEAL","DEAL") bernilai false. Yang menyelamatkan
    // kasus ini adalah klausa `input.status !== prospek.status` di service —
    // test ini yang akan gagal kalau klausa itu dihapus sebagai "redundan".
    vi.mocked(repository.findById).mockResolvedValue(
      prospek({ status: "DEAL" }),
    );
    vi.mocked(repository.update).mockResolvedValue(
      prospek({ status: "DEAL", catatan: "berkas sudah lengkap" }),
    );
    const service = new ProspekService(repository);

    const hasil = await service.ubah("prospek-1", {
      status: "DEAL",
      catatan: "berkas sudah lengkap",
    });

    expect(hasil.status).toBe("DEAL");
    expect(repository.update).toHaveBeenCalledOnce();
  });

  it("melempar 404 saat prospek yang diubah tidak ada", async () => {
    const service = new ProspekService(repository);

    await expect(
      service.ubah("tidak-ada", { catatan: "apa pun" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("mengizinkan perubahan saat pemilik wajibnya cocok", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      prospek({ pemilikId: "user-1" }),
    );
    vi.mocked(repository.update).mockResolvedValue(
      prospek({ pemilikId: "user-1", catatan: "sudah ditelepon" }),
    );
    const service = new ProspekService(repository);

    await service.ubah("prospek-1", { catatan: "sudah ditelepon" }, "user-1");

    expect(repository.update).toHaveBeenCalledOnce();
  });

  it("menolak sales mencuri prospek sales lain", async () => {
    // Tanpa pengikat ini, sales A bisa PATCH prospek sales B dengan
    // `pemilikId` dirinya sendiri — atau membunuhnya dengan TIDAK_MINAT.
    vi.mocked(repository.findById).mockResolvedValue(
      prospek({ pemilikId: "user-lain" }),
    );
    const service = new ProspekService(repository);

    await expect(
      service.ubah("prospek-1", { pemilikId: "user-1" }, "user-1"),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("menolak sales membunuh prospek sales lain lewat status", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      prospek({ pemilikId: "user-lain", status: "BARU" }),
    );
    const service = new ProspekService(repository);

    await expect(
      service.ubah("prospek-1", { status: "TIDAK_MINAT" }, "user-1"),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("tidak membatasi kepemilikan saat pemilik wajib tidak diisi", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      prospek({ pemilikId: "user-lain" }),
    );
    vi.mocked(repository.update).mockResolvedValue(
      prospek({ pemilikId: "user-lain", catatan: "dicatat admin" }),
    );
    const service = new ProspekService(repository);

    await service.ubah("prospek-1", { catatan: "dicatat admin" });

    expect(repository.update).toHaveBeenCalledOnce();
  });
});

describe("ProspekService.daftar", () => {
  it("meneruskan filter apa adanya ke repository", async () => {
    const repository = bangunRepository();
    vi.mocked(repository.findMany).mockResolvedValue({
      items: [prospek()],
      total: 1,
    });
    const service = new ProspekService(repository);

    const hasil = await service.daftar({
      page: 2,
      limit: 50,
      status: "TERTARIK",
    });

    expect(repository.findMany).toHaveBeenCalledWith({
      page: 2,
      limit: 50,
      status: "TERTARIK",
    });
    expect(hasil.total).toBe(1);
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

describe("ProspekService.buat — peringatan duplikat", () => {
  let repository: IProspekRepository;

  beforeEach(() => {
    repository = bangunRepository();
  });

  const masukan = {
    nama: "Budi",
    noTelp: "081234567890",
    alamat: "Jl. Merdeka 10",
    sumber: "WALK_IN" as const,
    pemilikId: "user-1",
  };

  it("menolak saat ada prospek aktif dengan nomor yang sama", async () => {
    vi.mocked(repository.findByNoTelp).mockResolvedValue([
      prospek({ id: "prospek-lama", status: "NEGOSIASI" }),
    ]);
    const service = new ProspekService(repository);

    await expect(service.buat(masukan)).rejects.toMatchObject({
      statusCode: 409,
      code: "DUPLIKAT",
    });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("menyertakan prospek duplikatnya supaya klien bisa menampilkannya", async () => {
    vi.mocked(repository.findByNoTelp).mockResolvedValue([
      prospek({ id: "prospek-lama", nama: "Budi Lama" }),
    ]);
    const service = new ProspekService(repository);

    await expect(service.buat(masukan)).rejects.toMatchObject({
      details: { duplikat: [{ id: "prospek-lama", nama: "Budi Lama" }] },
    });
  });

  it("tetap membuat saat pemanggil menyatakan duplikatnya disengaja", async () => {
    vi.mocked(repository.create).mockResolvedValue(prospek());
    const service = new ProspekService(repository);

    await service.buat(masukan, { abaikanDuplikat: true });

    expect(repository.create).toHaveBeenCalledOnce();
    // Bukan sekadar "tidak melempar": pencariannya harus benar-benar dilewati.
    // Menjalankannya lalu mengabaikan hasilnya membebani setiap pembuatan yang
    // disengaja dengan satu query pada kolom yang belum ber-index.
    expect(repository.findByNoTelp).not.toHaveBeenCalled();
  });

  it("tidak menghitung prospek yang sudah final sebagai duplikat", async () => {
    // Orang yang dulu menolak boleh dicatat lagi sebagai prospek baru —
    // yang mengganggu hanyalah dua prospek aktif untuk orang yang sama.
    vi.mocked(repository.findByNoTelp).mockResolvedValue([
      prospek({ id: "prospek-lama", status: "TIDAK_LAYAK" }),
      prospek({ id: "prospek-lawas", status: "DEAL" }),
    ]);
    vi.mocked(repository.create).mockResolvedValue(prospek());
    const service = new ProspekService(repository);

    await service.buat(masukan);

    expect(repository.create).toHaveBeenCalledOnce();
  });

  it("membuat langsung saat tidak ada nomor yang sama", async () => {
    vi.mocked(repository.findByNoTelp).mockResolvedValue([]);
    vi.mocked(repository.create).mockResolvedValue(prospek());
    const service = new ProspekService(repository);

    await service.buat(masukan);

    expect(repository.create).toHaveBeenCalledOnce();
  });
});
