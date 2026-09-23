import { BULAN_MAKS, BULAN_MIN } from "@/modules/presurvei/client";

/**
 * Periode bulanan (tahun + bulan) bersama layar presurvei.
 *
 * Tinggal di akar `presurvei/`, bukan di `target/`, karena pemiliknya bukan
 * satu layar: target, laporan, dan dasbor (yang juga berada di akar ini)
 * memakai periode yang sama dan param query yang sama — kedua route membaca
 * `laporanPeriodeSchema` (`modules/presurvei/validators/target.validator.ts:21-24`).
 */

export interface Periode {
  tahun: number;
  /** 1–12, bukan indeks nol seperti `Date.getMonth()`. */
  bulan: number;
}

/** Jarak tahun ke belakang dan ke depan yang ditawarkan pemilih tahun. */
const TAHUN_KE_BELAKANG = 2;
const TAHUN_KE_DEPAN = 1;

const PENGATUR_NAMA_BULAN = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  timeZone: "UTC",
});

/**
 * Periode bulan berjalan menurut kalender UTC.
 *
 * `Date.getMonth()` mengembalikan 0 untuk Januari; validator menuntut minimal
 * 1, jadi meneruskannya apa adanya membuat Januari ditolak.
 *
 * UTC dipilih supaya konsisten dengan server: batas bulan pencapaian di
 * `laporanPencapaian` (`modules/presurvei/services/TargetService.ts:52-56`)
 * dihitung dengan `Date.UTC` lewat `bangunRentangBulan` (baris 85-95).
 * Konsekuensi yang diterima: pemakai WIB (UTC+7) yang membuka layar pada
 * tanggal 1 pukul 00:00–06:59 melihat bulan sebelumnya sebagai periode
 * bawaan, dan perlu menggeser pemilih bulan sendiri.
 */
export function periodeSekarang(sekarang: Date = new Date()): Periode {
  return {
    tahun: sekarang.getUTCFullYear(),
    bulan: sekarang.getUTCMonth() + 1,
  };
}

/**
 * Query string periode, `tahun=…&bulan=…`.
 *
 * Nama param dicocokkan ke route yang membacanya lewat
 * `searchParams.get("tahun")`/`get("bulan")` — target
 * (`app/api/admin/presurvei/target/route.ts:17-20`) dan laporan
 * (`app/api/admin/presurvei/laporan/route.ts:16-19`); keduanya wajib.
 */
export function paramPeriode(periode: Periode): string {
  return new URLSearchParams({
    tahun: String(periode.tahun),
    bulan: String(periode.bulan),
  }).toString();
}

/**
 * Tahun yang ditawarkan pemilih periode, urut naik, sebagai array baru.
 *
 * Rentang kecil di sekitar tahun berjalan, bukan salinan batas validator
 * (tidak diekspor, `target.validator.ts:8-9`); server tetap memvalidasi.
 */
export function pilihanTahun(tahunBerjalan: number): number[] {
  const jumlah = TAHUN_KE_BELAKANG + TAHUN_KE_DEPAN + 1;
  const tahunAwal = tahunBerjalan - TAHUN_KE_BELAKANG;

  return Array.from({ length: jumlah }, (_, urutan) => tahunAwal + urutan);
}

/** Nomor bulan yang ditawarkan pemilih periode, `BULAN_MIN`..`BULAN_MAKS`. */
export function pilihanBulan(): number[] {
  const jumlah = BULAN_MAKS - BULAN_MIN + 1;

  return Array.from({ length: jumlah }, (_, urutan) => BULAN_MIN + urutan);
}

/** Nama bulan berbahasa Indonesia untuk nomor bulan 1–12. */
export function namaBulan(bulan: number): string {
  const TAHUN_ACUAN = 2000;
  const TANGGAL_PERTAMA = 1;

  return PENGATUR_NAMA_BULAN.format(
    new Date(Date.UTC(TAHUN_ACUAN, bulan - 1, TANGGAL_PERTAMA)),
  );
}
