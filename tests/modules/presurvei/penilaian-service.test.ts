import { describe, expect, it } from "vitest";
import type { RencanaEntity } from "@/modules/presurvei/domain/entities/Rencana";
import type { IRencanaRepository } from "@/modules/presurvei/domain/ports/IRencanaRepository";
import type { AnggotaTim, ITimSalesRepository } from "@/modules/presurvei/domain/ports/ITimSalesRepository";
import type { LingkupRencana } from "@/modules/presurvei/domain/rencana-rules";
import type { Pencapaian } from "@/modules/presurvei/domain/target-rules";
import { PenilaianService } from "@/modules/presurvei/services/PenilaianService";
import type { BarisLaporan, TargetService } from "@/modules/presurvei/services/TargetService";

/**
 * Tim: kepala "k" membina "a" & "b"; kepala "k2" membina "c".
 * Hari ini 2026-09-02 (Rabu) → hari kerja 1–2 Sep.
 */
const ANGGOTA: AnggotaTim[] = [
  { id: "a", nama: "Ani", kepalaSalesId: "k" },
  { id: "b", nama: "Budi", kepalaSalesId: "k" },
  { id: "c", nama: "Cici", kepalaSalesId: "k2" },
];
const PERIODE = { tahun: 2026, bulan: 9 };

const baris = (persen: number) => ({ target: 10, tercapai: persen / 10, persen });
const pencapaian = (persen: number): Pencapaian => ({
  kunjungan: baris(persen),
  prospek: baris(persen),
  konversi: baris(persen),
});

const rencana = (over: Partial<RencanaEntity>): RencanaEntity =>
  ({
    id: "r",
    salesId: "a",
    status: "SELESAI",
    sumber: "MANDIRI",
    dibuatOlehId: "a",
    tanggal: "2026-09-01",
    dilaporkanAt: new Date("2026-09-01T05:00:00Z"),
    ...over,
  }) as RencanaEntity;

function buatService(opsi: { laporan?: BarisLaporan[]; rencana?: RencanaEntity[] } = {}) {
  const targetService = {
    laporanPencapaian: async () => opsi.laporan ?? [],
  } as unknown as TargetService;
  const rencanaRepository = {
    findUntukRekap: async () => opsi.rencana ?? [],
  } as unknown as IRencanaRepository;
  const timRepository: ITimSalesRepository = {
    daftarAnggotaTim: async () => ANGGOTA,
    identitas: async (_tenant, ids) => ids.map((id) => ({ id, nama: id.toUpperCase() })),
  };
  return new PenilaianService(
    targetService,
    rencanaRepository,
    timRepository,
    async () => "Asia/Jakarta",
    () => new Date("2026-09-02T05:00:00Z"),
  );
}

const lingkup = (jenis: LingkupRencana["jenis"], penggunaId: string) =>
  ({ jenis, penggunaId }) as LingkupRencana;

describe("PenilaianService.nilai — lingkup", () => {
  it("SENDIRI: hanya sales pemanggil, tanpa penilaian kepala", async () => {
    const hasil = await buatService().nilai(PERIODE, lingkup("SENDIRI", "a"), "t1");

    expect(hasil.kepala).toEqual([]);
    expect(hasil.sales.map((s) => s.salesId)).toEqual(["a"]);
    expect(hasil.dihitungSampai).toBe("2026-09-02");
  });

  it("tanpa periode → bulan berjalan menurut zona waktu tenant", async () => {
    const hasil = await buatService().nilai(null, lingkup("SENDIRI", "a"), "t1");

    expect(hasil.periode).toEqual({ tahun: 2026, bulan: 9 });
  });

  it("TIM: kepala pemanggil + anggotanya, bukan tim lain", async () => {
    const hasil = await buatService().nilai(PERIODE, lingkup("TIM", "k"), "t1");

    expect(hasil.kepala.map((k) => k.kepalaId)).toEqual(["k"]);
    expect(hasil.kepala[0].jumlahAnggota).toBe(2);
    expect(hasil.sales.map((s) => s.salesId).sort()).toEqual(["a", "b", "k"]);
  });

  it("SEMUA: seluruh kepala sales beserta timnya", async () => {
    const hasil = await buatService().nilai(PERIODE, lingkup("SEMUA", "admin"), "t1");

    expect(hasil.kepala.map((k) => k.kepalaId).sort()).toEqual(["k", "k2"]);
    expect(hasil.sales.map((s) => s.salesId).sort()).toEqual(["a", "b", "c", "k", "k2"]);
  });
});

describe("PenilaianService.nilai — skor", () => {
  it("sales: gabungan aktivitas, konversi, realisasi; urut skor tertinggi", async () => {
    const hasil = await buatService({
      laporan: [
        { userId: "a", periodeTahun: 2026, periodeBulan: 9, pencapaian: pencapaian(100) },
        { userId: "b", periodeTahun: 2026, periodeBulan: 9, pencapaian: pencapaian(50) },
      ],
      rencana: [rencana({ salesId: "a" })],
    }).nilai(PERIODE, lingkup("TIM", "k"), "t1");

    const [ani, budi] = hasil.sales;
    expect(ani.salesId).toBe("a");
    expect(ani.skor).toBe(100);
    expect(ani.predikat).toBe("SANGAT_BAIK");
    // Budi tanpa rencana: realisasi belum terukur → bobotnya dibagi ulang.
    expect(budi.indikator.realisasi.nilai).toBeNull();
    expect(budi.skor).toBe(50);
    // Kepala tanpa target & rencana: belum terukur, di urutan akhir.
    expect(hasil.sales.at(-1)?.salesId).toBe("k");
    expect(hasil.sales.at(-1)?.skor).toBeNull();
  });

  it("kepala: realisasi penugasan hanya dari penugasan yang IA berikan; cakupan dari slot anggota×hari", async () => {
    const hasil = await buatService({
      laporan: [{ userId: "a", periodeTahun: 2026, periodeBulan: 9, pencapaian: pencapaian(80) }],
      rencana: [
        // Penugasan kepala: satu tepat waktu, satu terlewat.
        rencana({ salesId: "a", sumber: "PENUGASAN", dibuatOlehId: "k", tanggal: "2026-09-01" }),
        rencana({
          salesId: "b",
          sumber: "PENUGASAN",
          dibuatOlehId: "k",
          status: "DIRENCANAKAN",
          dilaporkanAt: null,
          tanggal: "2026-09-01",
        }),
        // Penugasan admin untuk anggota tim — bukan realisasi penugasan kepala.
        rencana({ salesId: "a", sumber: "PENUGASAN", dibuatOlehId: "admin", tanggal: "2026-09-02" }),
      ],
    }).nilai(PERIODE, lingkup("TIM", "k"), "t1");

    const kepala = hasil.kepala[0];
    expect(kepala.indikator.realisasiPenugasan.nilai).toBe(50);
    // a punya rencana 1 & 2 Sep, b hanya 1 Sep → 3 dari 4 slot.
    expect(kepala.indikator.cakupanPembinaan.nilai).toBe(75);
    // Rata-rata anggota yang terukur saja (Budi tanpa target).
    expect(kepala.indikator.aktivitasTim.nilai).toBe(80);
    expect(kepala.indikator.kinerjaPribadi.nilai).toBeNull();
    expect(kepala.skor).not.toBeNull();
  });
});
