import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { RencanaService } from "@/modules/presurvei/services/RencanaService";
import { PenugasanSalesService } from "@/modules/presurvei/services/PenugasanSalesService";
import type { RencanaEntity } from "@/modules/presurvei/domain/entities/Rencana";
import type { IRencanaRepository } from "@/modules/presurvei/domain/ports/IRencanaRepository";
import type { ISalesRepository } from "@/modules/presurvei/domain/ports/ISalesRepository";
import type { IProspekRepository } from "@/modules/presurvei/domain/ports/IProspekRepository";
import type { IKegiatanRepository } from "@/modules/presurvei/domain/ports/IKegiatanRepository";
import type { CalonSales } from "@/modules/presurvei/domain/penugasan-sales";
import type { LingkupRencana } from "@/modules/presurvei/domain/rencana-rules";
import type { PengumumPenugasanRencana } from "@/modules/presurvei/services/RencanaService";

const TENANT = "tenant-1";
// 03.00 UTC = 10.00 WIB tanggal 26.
const SEKARANG = new Date("2026-09-26T03:00:00Z");
const HARI_INI = "2026-09-26";

const rencana = (over: Partial<RencanaEntity> = {}): RencanaEntity => ({
  id: "r-1",
  salesId: "sales-a",
  namaSales: "Ani",
  dibuatOlehId: "kepala",
  namaPembuat: "Kepala",
  sumber: "PENUGASAN",
  jenis: "KUNJUNGAN",
  tanggal: HARI_INI,
  jam: null,
  tujuan: "Kunjungi Pak Budi",
  prospekId: null,
  namaProspek: null,
  alamat: null,
  latitude: null,
  longitude: null,
  status: "DIRENCANAKAN",
  kegiatanId: null,
  dilaporkanAt: null,
  alasanBatal: null,
  dibatalkanOlehId: null,
  dibatalkanAt: null,
  tenantId: TENANT,
  createdAt: SEKARANG,
  updatedAt: SEKARANG,
  ...over,
});

const calon = (over: Partial<CalonSales> = {}): CalonSales => ({
  id: "sales-a",
  tenantId: TENANT,
  isSales: true,
  isActive: true,
  ...over,
});

const bangunRepo = (): IRencanaRepository => ({
  findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  findById: vi.fn().mockResolvedValue(rencana()),
  create: vi.fn().mockImplementation(async (input) => rencana({ ...input })),
  ubahSelagiTerbuka: vi.fn().mockResolvedValue(rencana()),
  batalkanSelagiTerbuka: vi.fn().mockResolvedValue(rencana({ status: "BATAL" })),
  findUntukRekap: vi.fn().mockResolvedValue([]),
  anggotaTim: vi.fn().mockResolvedValue(["sales-a"]),
});

const bangunSalesRepo = (hasil: CalonSales | null = calon()): ISalesRepository => ({
  daftarAktif: vi.fn().mockResolvedValue([{ id: "sales-a", nama: "Ani" }]),
  daftarAktifDariIds: vi.fn().mockResolvedValue([{ id: "sales-a", nama: "Ani" }]),
  daftarKandidatKepalaSales: vi.fn(),
  cariCalonSales: vi.fn().mockResolvedValue(hasil),
});

const TIM: LingkupRencana = { jenis: "TIM", penggunaId: "kepala", anggotaIds: ["sales-a"] };
const SENDIRI_A: LingkupRencana = { jenis: "SENDIRI", penggunaId: "sales-a" };
const KEPALA = { id: "kepala", tenantId: TENANT };
const SALES_A = { id: "sales-a", tenantId: TENANT };

describe("RencanaService", () => {
  let repo: IRencanaRepository;
  let salesRepo: ISalesRepository;
  let prospekRepo: IProspekRepository;
  let umumkan: ReturnType<typeof vi.fn<PengumumPenugasanRencana>>;

  const service = () =>
    new RencanaService(
      repo,
      salesRepo,
      prospekRepo,
      { findById: vi.fn() } as unknown as IKegiatanRepository,
      new PenugasanSalesService(salesRepo),
      umumkan,
      async () => "Asia/Jakarta",
      () => SEKARANG,
    );

  beforeEach(() => {
    repo = bangunRepo();
    salesRepo = bangunSalesRepo();
    prospekRepo = {
      findById: vi.fn().mockResolvedValue({ id: "p-1", tenantId: TENANT }),
    } as unknown as IProspekRepository;
    umumkan = vi.fn<PengumumPenugasanRencana>().mockResolvedValue(undefined);
  });

  describe("buat", () => {
    const masukan = { salesId: "sales-a", tanggal: HARI_INI, jenis: "KUNJUNGAN" as const, tujuan: "Kunjungi" };

    it("kepala sales menugaskan anggota timnya: PENUGASAN dan sales dikabari", async () => {
      const hasil = await service().buat(masukan, KEPALA, TIM);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ salesId: "sales-a", dibuatOlehId: "kepala", sumber: "PENUGASAN", tenantId: TENANT }),
      );
      expect(hasil.sumber).toBe("PENUGASAN");
      expect(umumkan).toHaveBeenCalledWith(expect.objectContaining({ rencanaId: "r-1", salesId: "sales-a" }));
    });

    it("sales membuat rencana untuk dirinya: MANDIRI tanpa notifikasi", async () => {
      await service().buat({ ...masukan, salesId: undefined }, SALES_A, SENDIRI_A);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ salesId: "sales-a", sumber: "MANDIRI" }));
      expect(umumkan).not.toHaveBeenCalled();
    });

    it("menolak penugasan ke sales di luar tim (403) tanpa menulis apa pun", async () => {
      await expect(service().buat({ ...masukan, salesId: "sales-b" }, KEPALA, TIM)).rejects.toMatchObject({ statusCode: 403 });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("sales tidak bisa menugaskan rencana ke rekannya", async () => {
      await expect(service().buat({ ...masukan, salesId: "sales-b" }, SALES_A, SENDIRI_A)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("menolak calon yang bukan sales aktif (422 generik)", async () => {
      salesRepo = bangunSalesRepo(calon({ isSales: false }));
      await expect(service().buat(masukan, KEPALA, TIM)).rejects.toMatchObject({ statusCode: 422 });
    });

    it("menolak tanggal kemarin menurut zona tenant (400)", async () => {
      await expect(service().buat({ ...masukan, tanggal: "2026-09-25" }, KEPALA, TIM)).rejects.toMatchObject({ statusCode: 400 });
    });

    it("menolak prospek tenant lain seperti tidak ada (404)", async () => {
      prospekRepo.findById = vi.fn().mockResolvedValue({ id: "p-1", tenantId: "tenant-lain" });
      await expect(service().buat({ ...masukan, prospekId: "p-1" }, KEPALA, TIM)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("gagal mengumumkan tidak menggagalkan penugasan yang sudah tersimpan", async () => {
      umumkan.mockRejectedValue(new Error("redis mati"));
      await expect(service().buat(masukan, KEPALA, TIM)).resolves.toMatchObject({ id: "r-1" });
    });
  });

  describe("batalkan", () => {
    it("sales tidak boleh membatalkan penugasan dari atasan (403)", async () => {
      await expect(service().batalkan("r-1", "sakit", SALES_A, SENDIRI_A)).rejects.toMatchObject({ statusCode: 403 });
      expect(repo.batalkanSelagiTerbuka).not.toHaveBeenCalled();
    });

    it("sales boleh membatalkan rencana mandirinya, alasan & pelaku tercatat", async () => {
      repo.findById = vi.fn().mockResolvedValue(rencana({ sumber: "MANDIRI", dibuatOlehId: "sales-a" }));
      await service().batalkan("r-1", "hujan deras", SALES_A, SENDIRI_A);

      expect(repo.batalkanSelagiTerbuka).toHaveBeenCalledWith("r-1", { alasan: "hujan deras", olehId: "sales-a", pada: SEKARANG });
    });

    it("rencana yang sudah dilaporkan tidak bisa dibatalkan (409)", async () => {
      repo.findById = vi.fn().mockResolvedValue(rencana({ status: "SELESAI" }));
      await expect(service().batalkan("r-1", "salah", KEPALA, TIM)).rejects.toMatchObject({ statusCode: 409 });
    });

    it("balapan: rencana tertutup di sela pembacaan dan penulisan → 409", async () => {
      repo.batalkanSelagiTerbuka = vi.fn().mockResolvedValue(null);
      await expect(service().batalkan("r-1", "salah", KEPALA, TIM)).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe("rincian", () => {
    it("rencana tenant lain dijawab 404, bukan 403", async () => {
      repo.findById = vi.fn().mockResolvedValue(rencana({ tenantId: "tenant-lain" }));
      await expect(service().rincian("r-1", TIM, TENANT)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("sales lain di tenant yang sama dijawab 403", async () => {
      repo.findById = vi.fn().mockResolvedValue(rencana({ salesId: "sales-b" }));
      await expect(service().rincian("r-1", TIM, TENANT)).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe("lingkup & daftar", () => {
    it("lingkup TIM memuat anggota tim kepala sales", async () => {
      await expect(service().lingkup(KEPALA, "TIM")).resolves.toEqual(TIM);
      expect(repo.anggotaTim).toHaveBeenCalledWith("kepala", TENANT);
    });

    it("daftar dibatasi ke sales dalam lingkup dengan hari ini WIB", async () => {
      await service().daftar({ page: 1, limit: 20 }, TIM, TENANT);

      expect(repo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT, salesIds: ["kepala", "sales-a"], hariIni: HARI_INI }),
      );
    });

    it("sales tersedia bagi kepala sales hanya dirinya + timnya", async () => {
      await service().salesTersedia(KEPALA, TIM);
      expect(salesRepo.daftarAktifDariIds).toHaveBeenCalledWith(TENANT, ["kepala", "sales-a"]);
      expect(salesRepo.daftarAktif).not.toHaveBeenCalled();
    });
  });
});
