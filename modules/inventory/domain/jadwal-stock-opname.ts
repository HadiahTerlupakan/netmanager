/**
 * Jadwal & kepatuhan stock opname (SO) bulanan — fungsi murni.
 *
 * Jadwal diatur per SITE. Setiap bulan site punya jendela SO (rentang tanggal
 * kalender WIB, inklusif): jadwal khusus bulan itu bila ada, selain itu jadwal
 * bawaan site ("tanggal X–Y setiap bulan"). Site tanpa jadwal dinilai sebulan
 * penuh. Gudang dinilai dari barang yang punya stok di gudang itu: berapa yang
 * sudah dihitung di dalam jendela site-nya.
 */

/** Indonesia tidak memakai DST; tanggal kalender tenant = WIB. */
const OFFSET_WIB_MS = 7 * 60 * 60 * 1000;
const POLA_PERIODE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export const TANGGAL_MINIMUM = 1;
export const TANGGAL_MAKSIMUM = 31;

/** Jadwal bawaan site: tanggal mulai–selesai setiap bulan. */
export interface AturanJadwalSo {
  isAktif: boolean;
  tanggalMulai: number;
  tanggalSelesai: number;
}

/** Isian awal form jadwal site yang belum pernah diatur. */
export const ATURAN_JADWAL_AWAL: AturanJadwalSo = {
  isAktif: true,
  tanggalMulai: 25,
  tanggalSelesai: TANGGAL_MAKSIMUM,
};

/** Jendela SO satu bulan, tanggal kalender WIB "YYYY-MM-DD" (inklusif). */
export interface JendelaSo {
  periode: string;
  mulai: string;
  selesai: string;
  /** KHUSUS = jadwal bulan itu; BAWAAN = jadwal bawaan site; TANPA_JADWAL = site belum diatur (sebulan penuh). */
  sumber: "KHUSUS" | "BAWAAN" | "TANPA_JADWAL";
}

export type KeadaanJendela = "BELUM_DIBUKA" | "TERBUKA" | "DITUTUP";

export type StatusSoGudang =
  /** Semua barang berstok sudah dihitung di dalam jadwal. */
  | "LENGKAP"
  /** Sebagian barang berstok sudah dihitung di dalam jadwal. */
  | "SEBAGIAN"
  /** Ada SO bulan ini tetapi di luar jadwal. */
  | "DI_LUAR_JADWAL"
  /** Belum ada SO bulan ini. */
  | "BELUM"
  /** Gudang tidak punya barang berstok — tidak ada yang perlu dihitung. */
  | "TANPA_STOK";

/** Apakah teks berbentuk periode "YYYY-MM". */
export function isPeriodeSah(periode: string): boolean {
  return POLA_PERIODE.test(periode);
}

/** Apakah teks berbentuk tanggal "YYYY-MM-DD" yang benar-benar ada. */
export function isTanggalSah(tanggal: string): boolean {
  if (!POLA_TANGGAL.test(tanggal)) return false;
  const waktu = new Date(`${tanggal}T00:00:00.000Z`);
  return !Number.isNaN(waktu.getTime()) && waktu.toISOString().slice(0, 10) === tanggal;
}

/** Periode "YYYY-MM" menurut kalender WIB pada saat `waktu`. */
export function periodeDari(waktu: Date): string {
  return tanggalWib(waktu).slice(0, 7);
}

/** Tanggal kalender WIB "YYYY-MM-DD" pada saat `waktu`. */
export function tanggalWib(waktu: Date): string {
  return new Date(waktu.getTime() + OFFSET_WIB_MS).toISOString().slice(0, 10);
}

function jumlahHariDalamBulan(periode: string): number {
  const [tahun, bulan] = periode.split("-").map(Number);
  return new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
}

function tanggalPeriode(periode: string, hari: number): string {
  const hariSah = Math.min(Math.max(hari, TANGGAL_MINIMUM), jumlahHariDalamBulan(periode));
  return `${periode}-${String(hariSah).padStart(2, "0")}`;
}

/** Jendela SO dari aturan bawaan; tanggal di atas akhir bulan menjadi tanggal terakhir. */
export function jendelaDariAturan(periode: string, aturan: AturanJadwalSo): JendelaSo {
  return {
    periode,
    mulai: tanggalPeriode(periode, aturan.tanggalMulai),
    selesai: tanggalPeriode(periode, aturan.tanggalSelesai),
    sumber: "BAWAAN",
  };
}

/** Jendela sebulan penuh untuk site yang belum punya jadwal. */
export function jendelaSebulanPenuh(periode: string): JendelaSo {
  return {
    periode,
    mulai: tanggalPeriode(periode, TANGGAL_MINIMUM),
    selesai: tanggalPeriode(periode, TANGGAL_MAKSIMUM),
    sumber: "TANPA_JADWAL",
  };
}

/** Rentang waktu UTC jendela: awal hari mulai s.d. akhir hari selesai (WIB). */
export function rentangWaktuJendela(jendela: Pick<JendelaSo, "mulai" | "selesai">): {
  dari: Date;
  sampai: Date;
} {
  const dari = new Date(new Date(`${jendela.mulai}T00:00:00.000Z`).getTime() - OFFSET_WIB_MS);
  const sampai = new Date(
    new Date(`${jendela.selesai}T23:59:59.999Z`).getTime() - OFFSET_WIB_MS,
  );
  return { dari, sampai };
}

/** Rentang waktu UTC satu bulan kalender WIB. */
export function rentangWaktuPeriode(periode: string): { dari: Date; sampai: Date } {
  return rentangWaktuJendela({
    mulai: tanggalPeriode(periode, TANGGAL_MINIMUM),
    selesai: tanggalPeriode(periode, TANGGAL_MAKSIMUM),
  });
}

/** Keadaan jendela pada saat `sekarang`. */
export function keadaanJendela(jendela: JendelaSo, sekarang: Date): KeadaanJendela {
  const hariIni = tanggalWib(sekarang);
  if (hariIni < jendela.mulai) return "BELUM_DIBUKA";
  if (hariIni > jendela.selesai) return "DITUTUP";
  return "TERBUKA";
}

/** Validasi aturan bawaan; mengembalikan pesan galat atau null. */
export function validasiAturan(aturan: Pick<AturanJadwalSo, "tanggalMulai" | "tanggalSelesai">): string | null {
  const { tanggalMulai, tanggalSelesai } = aturan;
  const isSah = (hari: number) =>
    Number.isInteger(hari) && hari >= TANGGAL_MINIMUM && hari <= TANGGAL_MAKSIMUM;
  if (!isSah(tanggalMulai) || !isSah(tanggalSelesai)) return "Tanggal harus 1–31";
  if (tanggalSelesai < tanggalMulai) return "Tanggal selesai tidak boleh sebelum tanggal mulai";
  return null;
}

/** Validasi jadwal khusus: kedua tanggal di dalam bulan periode dan berurutan. */
export function validasiJadwalKhusus(periode: string, mulai: string, selesai: string): string | null {
  if (!isPeriodeSah(periode)) return "Periode harus berformat YYYY-MM";
  if (!isTanggalSah(mulai) || !isTanggalSah(selesai)) return "Tanggal tidak valid";
  if (!mulai.startsWith(periode) || !selesai.startsWith(periode)) {
    return "Tanggal jadwal harus di dalam bulan yang dipilih";
  }
  if (selesai < mulai) return "Tanggal selesai tidak boleh sebelum tanggal mulai";
  return null;
}

/** Data hitungan satu gudang dalam satu bulan. */
export interface HitunganGudang {
  /** Barang yang punya stok di gudang (yang wajib dihitung). */
  barangBerstok: ReadonlySet<string>;
  /** Barang yang dihitung di dalam jendela. */
  barangDihitungDalamJadwal: ReadonlySet<string>;
  /** Barang yang dihitung kapan pun di bulan itu. */
  barangDihitungBulanIni: ReadonlySet<string>;
}

/** Ringkasan status SO satu gudang. */
export interface RingkasanSoGudang {
  status: StatusSoGudang;
  jumlahBarangBerstok: number;
  jumlahDihitungDalamJadwal: number;
}

/** Status SO satu gudang untuk satu bulan. */
export function nilaiStatusGudang(hitungan: HitunganGudang): RingkasanSoGudang {
  const wajib = [...hitungan.barangBerstok];
  const dihitung = wajib.filter((id) => hitungan.barangDihitungDalamJadwal.has(id)).length;
  const ringkasan = (status: StatusSoGudang): RingkasanSoGudang => ({
    status,
    jumlahBarangBerstok: wajib.length,
    jumlahDihitungDalamJadwal: dihitung,
  });

  if (wajib.length === 0) return ringkasan("TANPA_STOK");
  if (dihitung === wajib.length) return ringkasan("LENGKAP");
  if (dihitung > 0) return ringkasan("SEBAGIAN");
  // Hanya barang wajib (berstok) yang dinilai; menghitung barang lain tidak dianggap SO.
  if (wajib.some((id) => hitungan.barangDihitungBulanIni.has(id))) return ringkasan("DI_LUAR_JADWAL");
  return ringkasan("BELUM");
}

/** Status yang dianggap belum tuntas dan perlu diingatkan. */
export function isPerluDiingatkan(status: StatusSoGudang): boolean {
  return status === "BELUM" || status === "SEBAGIAN" || status === "DI_LUAR_JADWAL";
}
