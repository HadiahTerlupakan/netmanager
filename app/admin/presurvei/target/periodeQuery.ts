import { BULAN_MAKS, BULAN_MIN } from "@/modules/presurvei/client";

/**
 * Periode target (tahun + bulan) dan URL/kunci cache yang dibentuk darinya.
 *
 * Dipakai layar target, laporan, dan dasbor presurvei — satu definisi supaya
 * ketiganya membentuk URL dan kunci cache yang sama untuk periode yang sama.
 */

export interface Periode {
  tahun: number;
  /** 1–12, bukan indeks nol seperti `Date.getMonth()`. */
  bulan: number;
}

/** Endpoint target presurvei (`app/api/admin/presurvei/target/route.ts`). */
export const URL_API_TARGET = "/api/admin/presurvei/target";

/** Awalan `queryKey` target satu periode. */
export const KUNCI_TARGET_PERIODE = "presurvei-target-periode";

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
 * UTC dipilih supaya konsisten dengan server: batas bulan target dihitung
 * dengan `Date.UTC` di `bangunRentangBulan`
 * (`modules/presurvei/services/TargetService.ts:85-95`). Konsekuensi yang
 * diterima: pemakai WIB (UTC+7) yang membuka layar pada tanggal 1 pukul
 * 00:00–06:59 melihat bulan sebelumnya sebagai periode bawaan, dan perlu
 * menggeser pemilih bulan sendiri.
 */
export function periodeSekarang(sekarang: Date = new Date()): Periode {
  return {
    tahun: sekarang.getUTCFullYear(),
    bulan: sekarang.getUTCMonth() + 1,
  };
}

/**
 * URL `GET` target satu periode.
 *
 * Nama param `tahun`/`bulan` dicocokkan ke `laporanPeriodeSchema`
 * (`modules/presurvei/validators/target.validator.ts:21-24`) yang dibaca route
 * lewat `searchParams.get("tahun")`/`get("bulan")`; keduanya wajib.
 */
export function buildTargetUrl(periode: Periode): string {
  const params = new URLSearchParams({
    tahun: String(periode.tahun),
    bulan: String(periode.bulan),
  });

  return `${URL_API_TARGET}?${params.toString()}`;
}

/** Kunci cache target satu periode; dipakai pengambil maupun invalidasi. */
export function kunciQueryTarget(periode: Periode): [string, string] {
  return [KUNCI_TARGET_PERIODE, buildTargetUrl(periode)];
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
