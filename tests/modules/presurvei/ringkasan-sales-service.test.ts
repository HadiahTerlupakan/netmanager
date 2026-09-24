import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IRingkasanSalesRepository } from "@/modules/presurvei/domain/ports/IRingkasanSalesRepository";
import { BATAS_PERLU_FOLLOW_UP } from "@/modules/presurvei/domain/ringkasan-sales";
import type { ProspekSentuhan } from "@/modules/presurvei/domain/ringkasan-sales";
import type {
  BarisLaporan,
  TargetService,
} from "@/modules/presurvei/services/TargetService";
import { RingkasanSalesService } from "@/modules/presurvei/services/RingkasanSalesService";

/**
 * Service hanya merangkai: identitas dan tenant berasal dari masukan (route
 * mengisinya dari sesi), batas waktu dari `sekarang`. `userId` dan
 * `tenantId` bernilai berbeda supaya tertukarnya terlihat.
 */

const ID_SALES = "sales-a";
const ID_TENANT = "tenant-x";
const SEKARANG = new Date("2026-09-24T23:30:00.000Z");

const PROSPEK_A: ProspekSentuhan = {
  id: "p-a",
  nama: "Andi",
  noTelp: "081201",
  status: "TERTARIK",
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
};
const PROSPEK_B: ProspekSentuhan = {
  id: "p-b",
  nama: "Bela",
  noTelp: "081202",
  status: "DIHUBUNGI",
  updatedAt: new Date("2026-09-10T00:00:00.000Z"),
};

const bangunRepo = (): IRingkasanSalesRepository => ({
  hitungKegiatanPerJenis: vi
    .fn()
    .mockResolvedValue({ KUNJUNGAN: 3, TELEPON: 4 }),
  daftarProspekAktif: vi.fn().mockResolvedValue([PROSPEK_A, PROSPEK_B]),
  waktuKegiatanTerakhir: vi
    .fn()
    .mockResolvedValue({ "p-a": new Date("2026-09-20T00:00:00.000Z") }),
});

describe("RingkasanSalesService.ringkasan", () => {
  let repo: IRingkasanSalesRepository;
  let pencapaianSendiri: ReturnType<
    typeof vi.fn<TargetService["pencapaianSendiri"]>
  >;

  beforeEach(() => {
    repo = bangunRepo();
    pencapaianSendiri = vi
      .fn<TargetService["pencapaianSendiri"]>()
      .mockResolvedValue(null);
  });

  const jalankan = () =>
    new RingkasanSalesService(repo, { pencapaianSendiri }).ringkasan({
      userId: ID_SALES,
      tenantId: ID_TENANT,
      sekarang: SEKARANG,
    });

  it("meneruskan userId dan tenantId ke setiap sumber tanpa tertukar", async () => {
    await jalankan();

    expect(repo.hitungKegiatanPerJenis).toHaveBeenCalledWith(
      ID_SALES,
      {
        mulai: new Date("2026-09-24T00:00:00.000Z"),
        selesai: new Date("2026-09-24T23:59:59.999Z"),
      },
      ID_TENANT,
    );
    expect(repo.daftarProspekAktif).toHaveBeenCalledWith(ID_SALES, ID_TENANT);
    expect(pencapaianSendiri).toHaveBeenCalledWith(
      ID_SALES,
      { tahun: 2026, bulan: 9 },
      ID_TENANT,
    );
    expect(repo.waktuKegiatanTerakhir).toHaveBeenCalledWith(
      ["p-a", "p-b"],
      ID_TENANT,
    );
  });

  it("target belum ditetapkan tetap null, bukan nol", async () => {
    const hasil = await jalankan();

    expect(hasil.target).toBeNull();
  });

  it("memetakan target yang ada tanpa membawa userId", async () => {
    const baris: BarisLaporan = {
      userId: ID_SALES,
      periodeTahun: 2026,
      periodeBulan: 9,
      pencapaian: {
        kunjungan: { target: 20, tercapai: 10, persen: 50 },
        prospek: { target: 10, tercapai: 3, persen: 30 },
        konversi: { target: 5, tercapai: 1, persen: 20 },
      },
    };
    pencapaianSendiri.mockResolvedValue(baris);

    const hasil = await jalankan();

    // Literal, bukan `baris.pencapaian`: memakai referensi yang sama sebagai
    // input dan harapan lolos begitu saja bila `keTargetSendiri` meneruskan
    // objek itu apa adanya tanpa benar-benar memetakannya.
    expect(hasil.target).toEqual({
      periodeTahun: 2026,
      periodeBulan: 9,
      pencapaian: {
        kunjungan: { target: 20, tercapai: 10, persen: 50 },
        prospek: { target: 10, tercapai: 3, persen: 30 },
        konversi: { target: 5, tercapai: 1, persen: 20 },
      },
    });
  });

  it("melengkapi hitungan hari ini dengan nol", async () => {
    const hasil = await jalankan();

    expect(hasil.kegiatanHariIni).toEqual({
      KUNJUNGAN: 3,
      SURVEI_LOKASI: 0,
      TELEPON: 4,
      CHAT: 0,
      IKLAN: 0,
    });
  });

  it("mengurutkan follow-up menurut sentuhan terakhir", async () => {
    const hasil = await jalankan();

    expect(hasil.perluFollowUp.map((baris) => baris.id)).toEqual([
      "p-b",
      "p-a",
    ]);
  });

  it("membatasi follow-up sampai BATAS_PERLU_FOLLOW_UP, terlama lebih dulu", async () => {
    // Enam prospek — satu lebih banyak dari BATAS_PERLU_FOLLOW_UP (5) — supaya
    // pemotongannya benar-benar teruji. Fixture dua prospek di atas tidak
    // pernah melewati batas, jadi mutasi yang menghapus `.slice(0, batas)`
    // atau mengubah nilai batasnya tetap hijau tanpa test ini.
    const enamProspek: ProspekSentuhan[] = Array.from(
      { length: 6 },
      (_, i) => ({
        id: `p-${i + 1}`,
        nama: `Prospek ${i + 1}`,
        noTelp: `08120${i + 1}`,
        status: "TERTARIK",
        updatedAt: new Date(Date.UTC(2026, 8, i + 1)),
      }),
    );
    vi.mocked(repo.daftarProspekAktif).mockResolvedValue(enamProspek);
    vi.mocked(repo.waktuKegiatanTerakhir).mockResolvedValue({});

    const hasil = await jalankan();

    expect(hasil.perluFollowUp).toHaveLength(BATAS_PERLU_FOLLOW_UP);
    // p-6 (2026-09-06) paling baru disentuh dari keenamnya, jadi ia yang
    // tersisih — lima sisanya (p-1..p-5) yang paling lama tak disentuh.
    expect(hasil.perluFollowUp.map((baris) => baris.id)).toEqual([
      "p-1",
      "p-2",
      "p-3",
      "p-4",
      "p-5",
    ]);
  });

  it("tanggal ringkasan adalah awal hari UTC", async () => {
    const hasil = await jalankan();

    expect(hasil.tanggal).toEqual(new Date("2026-09-24T00:00:00.000Z"));
  });
});
