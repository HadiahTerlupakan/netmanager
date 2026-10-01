import { getTimezone } from "@/lib/utils/get-timezone";
import type { RencanaEntity } from "../domain/entities/Rencana";
import type { PeriodeTarget } from "../domain/entities/Target";
import {
  BOBOT_PENILAIAN_KEPALA,
  BOBOT_PENILAIAN_SALES,
  gabungSkor,
  hariKerjaBulan,
  nilaiAktivitas,
  nilaiCakupan,
  nilaiKonversi,
  nilaiRealisasi,
  rataRata,
  rekapRealisasi,
  tentukanPredikat,
  type Indikator,
  type PredikatPenilaian,
  type RekapRealisasi,
} from "../domain/penilaian-rules";
import type { IRencanaRepository } from "../domain/ports/IRencanaRepository";
import type { AnggotaTim, ITimSalesRepository } from "../domain/ports/ITimSalesRepository";
import type { LingkupRencana } from "../domain/rencana-rules";
import { tanggalLokal } from "../domain/rencana-rules";
import type { Pencapaian } from "../domain/target-rules";
import { RencanaRepository } from "../repositories/RencanaRepository";
import { TimSalesRepository } from "../repositories/TimSalesRepository";
import { TargetService } from "./TargetService";

/** Penilaian seorang sales pada satu bulan. */
export interface PenilaianSales {
  salesId: string;
  nama: string;
  kepalaSalesId: string | null;
  skor: number | null;
  predikat: PredikatPenilaian | null;
  indikator: {
    aktivitas: Indikator;
    konversi: Indikator;
    realisasi: Indikator;
  };
  /** Target & realisasi bulan ini; null = target belum ditetapkan. */
  pencapaian: Pencapaian | null;
  rencana: RekapRealisasi;
}

/** Penilaian seorang kepala sales beserta timnya pada satu bulan. */
export interface PenilaianKepala {
  kepalaId: string;
  nama: string;
  jumlahAnggota: number;
  skor: number | null;
  predikat: PredikatPenilaian | null;
  indikator: {
    aktivitasTim: Indikator;
    konversiTim: Indikator;
    realisasiPenugasan: Indikator;
    cakupanPembinaan: Indikator;
    kinerjaPribadi: Indikator;
  };
}

export interface HasilPenilaian {
  periode: PeriodeTarget;
  /** Batas hitung: hari ini (bulan berjalan) atau hari terakhir bulan. */
  dihitungSampai: string;
  kepala: PenilaianKepala[];
  sales: PenilaianSales[];
}

type PenentuZonaWaktu = (tenantId: string) => Promise<string>;

/** Siapa yang dinilai menurut lingkup pemanggil. */
interface Sasaran {
  kepalaIds: string[];
  salesIds: string[];
}

/**
 * Penilaian kinerja bulanan: setiap sales (aktivitas, konversi, realisasi
 * rencana) dan setiap kepala sales (kinerja tim, realisasi penugasan yang ia
 * berikan, cakupan pembinaan, kinerja pribadinya).
 *
 * Capaian target memakai `TargetService.laporanPencapaian` — angka yang sama
 * dengan layar Laporan Pencapaian. Dihitung langsung saat diminta (belum
 * dikunci per periode).
 */
export class PenilaianService {
  constructor(
    private readonly targetService: TargetService = new TargetService(),
    private readonly rencanaRepository: IRencanaRepository = new RencanaRepository(),
    private readonly timRepository: ITimSalesRepository = new TimSalesRepository(),
    private readonly tentukanZonaWaktu: PenentuZonaWaktu = getTimezone,
    private readonly sekarang: () => Date = () => new Date(),
  ) {}

  /** Nilai kinerja pada `periodeDiminta` (null = bulan berjalan) sesuai lingkup. */
  async nilai(
    periodeDiminta: PeriodeTarget | null,
    lingkup: LingkupRencana,
    tenantId: string,
  ): Promise<HasilPenilaian> {
    const zonaWaktu = await this.tentukanZonaWaktu(tenantId);
    const hariIni = tanggalLokal(this.sekarang(), zonaWaktu);
    const periode = periodeDiminta ?? periodeDariTanggal(hariIni);
    const { awal, akhir } = batasBulan(periode);
    const dihitungSampai = hariIni < akhir ? hariIni : akhir;

    const anggota = await this.timRepository.daftarAnggotaTim(tenantId);
    const sasaran = tentukanSasaran(anggota, lingkup);
    const [laporan, rencana, identitas] = await Promise.all([
      this.targetService.laporanPencapaian(periode),
      this.rencanaRepository.findUntukRekap({ tenantId, dari: awal, sampai: dihitungSampai }),
      this.timRepository.identitas(tenantId, [...sasaran.kepalaIds, ...sasaran.salesIds]),
    ]);

    const pencapaianPer = new Map(laporan.map((baris) => [baris.userId, baris.pencapaian]));
    const namaPer = new Map(identitas.map((item) => [item.id, item.nama]));
    const kepalaPer = new Map(anggota.map((item) => [item.id, item.kepalaSalesId]));

    const sales = sasaran.salesIds.map((salesId) =>
      nilaiSales({
        salesId,
        nama: namaPer.get(salesId) ?? salesId,
        kepalaSalesId: kepalaPer.get(salesId) ?? null,
        pencapaian: pencapaianPer.get(salesId) ?? null,
        rencana: rencana.filter((item) => item.salesId === salesId),
        hariIni,
        zonaWaktu,
      }),
    );
    const salesPer = new Map(sales.map((item) => [item.salesId, item]));
    const hariKerja = hariKerjaBulan(periode.tahun, periode.bulan, dihitungSampai);

    const kepala = sasaran.kepalaIds.map((kepalaId) => {
      const anggotaIds = anggota.filter((item) => item.kepalaSalesId === kepalaId).map((item) => item.id);
      return nilaiKepala({
        kepalaId,
        nama: namaPer.get(kepalaId) ?? kepalaId,
        anggotaIds,
        penilaianAnggota: anggotaIds.map((id) => salesPer.get(id)).filter(isAda),
        penilaianPribadi: salesPer.get(kepalaId) ?? null,
        penugasan: rencana.filter((item) => item.dibuatOlehId === kepalaId && item.sumber === "PENUGASAN"),
        rencanaTim: rencana,
        hariKerja,
        hariIni,
        zonaWaktu,
      });
    });

    return {
      periode,
      dihitungSampai,
      kepala: urutkanSkor(kepala),
      sales: urutkanSkor(sales),
    };
  }
}

function isAda<T>(nilai: T | undefined): nilai is T {
  return nilai !== undefined;
}

/** Periode bulan dari tanggal "YYYY-MM-DD". */
function periodeDariTanggal(tanggal: string): PeriodeTarget {
  const [tahun, bulan] = tanggal.split("-").map(Number);
  return { tahun, bulan };
}

/** Tanggal pertama & terakhir bulan, "YYYY-MM-DD". */
function batasBulan(periode: PeriodeTarget): { awal: string; akhir: string } {
  const awal = new Date(Date.UTC(periode.tahun, periode.bulan - 1, 1));
  const akhir = new Date(Date.UTC(periode.tahun, periode.bulan, 0));
  return { awal: awal.toISOString().slice(0, 10), akhir: akhir.toISOString().slice(0, 10) };
}

/**
 * Lingkup → siapa yang dinilai. SEMUA: seluruh kepala sales dan tim-timnya.
 * TIM: dirinya (sebagai kepala & sales) + anggotanya. SENDIRI: dirinya saja.
 */
function tentukanSasaran(anggota: readonly AnggotaTim[], lingkup: LingkupRencana): Sasaran {
  const pengguna = lingkup.penggunaId;
  if (lingkup.jenis === "SENDIRI") return { kepalaIds: [], salesIds: [pengguna] };

  const kepalaIds =
    lingkup.jenis === "SEMUA"
      ? [...new Set(anggota.map((item) => item.kepalaSalesId))]
      : [pengguna];
  const anggotaIds = anggota
    .filter((item) => kepalaIds.includes(item.kepalaSalesId))
    .map((item) => item.id);
  return { kepalaIds, salesIds: [...new Set([...kepalaIds, ...anggotaIds])] };
}

interface MasukanNilaiSales {
  salesId: string;
  nama: string;
  kepalaSalesId: string | null;
  pencapaian: Pencapaian | null;
  rencana: readonly RencanaEntity[];
  hariIni: string;
  zonaWaktu: string;
}

function nilaiSales(masukan: MasukanNilaiSales): PenilaianSales {
  const rekap = rekapRealisasi(masukan.rencana, masukan.hariIni, masukan.zonaWaktu);
  const indikator = {
    aktivitas: { nilai: nilaiAktivitas(masukan.pencapaian), bobot: BOBOT_PENILAIAN_SALES.aktivitas },
    konversi: { nilai: nilaiKonversi(masukan.pencapaian), bobot: BOBOT_PENILAIAN_SALES.konversi },
    realisasi: { nilai: nilaiRealisasi(rekap), bobot: BOBOT_PENILAIAN_SALES.realisasi },
  };
  const skor = gabungSkor(Object.values(indikator));
  return {
    salesId: masukan.salesId,
    nama: masukan.nama,
    kepalaSalesId: masukan.kepalaSalesId,
    skor,
    predikat: tentukanPredikat(skor),
    indikator,
    pencapaian: masukan.pencapaian,
    rencana: rekap,
  };
}

interface MasukanNilaiKepala {
  kepalaId: string;
  nama: string;
  anggotaIds: string[];
  penilaianAnggota: PenilaianSales[];
  penilaianPribadi: PenilaianSales | null;
  penugasan: readonly RencanaEntity[];
  rencanaTim: readonly RencanaEntity[];
  hariKerja: readonly string[];
  hariIni: string;
  zonaWaktu: string;
}

function nilaiKepala(masukan: MasukanNilaiKepala): PenilaianKepala {
  const indikator = {
    aktivitasTim: {
      nilai: rataRata(masukan.penilaianAnggota.map((item) => item.indikator.aktivitas.nilai)),
      bobot: BOBOT_PENILAIAN_KEPALA.aktivitasTim,
    },
    konversiTim: {
      nilai: rataRata(masukan.penilaianAnggota.map((item) => item.indikator.konversi.nilai)),
      bobot: BOBOT_PENILAIAN_KEPALA.konversiTim,
    },
    realisasiPenugasan: {
      nilai: nilaiRealisasi(rekapRealisasi(masukan.penugasan, masukan.hariIni, masukan.zonaWaktu)),
      bobot: BOBOT_PENILAIAN_KEPALA.realisasiPenugasan,
    },
    cakupanPembinaan: {
      nilai: nilaiCakupan(masukan.anggotaIds, masukan.rencanaTim, masukan.hariKerja),
      bobot: BOBOT_PENILAIAN_KEPALA.cakupanPembinaan,
    },
    kinerjaPribadi: {
      nilai: masukan.penilaianPribadi?.skor ?? null,
      bobot: BOBOT_PENILAIAN_KEPALA.kinerjaPribadi,
    },
  };
  const skor = gabungSkor(Object.values(indikator));
  return {
    kepalaId: masukan.kepalaId,
    nama: masukan.nama,
    jumlahAnggota: masukan.anggotaIds.length,
    skor,
    predikat: tentukanPredikat(skor),
    indikator,
  };
}

/** Skor tertinggi dulu; belum terukur di akhir; seri → nama. */
function urutkanSkor<T extends { skor: number | null; nama: string }>(daftar: T[]): T[] {
  return [...daftar].sort(
    (a, b) => (b.skor ?? -1) - (a.skor ?? -1) || a.nama.localeCompare(b.nama),
  );
}
