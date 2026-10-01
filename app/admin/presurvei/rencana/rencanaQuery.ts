import {
  RENTANG_REKAP_HARI_MAKS,
  type RencanaStatusTampil,
} from "@/modules/presurvei/client";

import type { RentangTanggal } from "./rentangTanggal";

/** Endpoint rencana (`app/api/presurvei/rencana/route.ts`). */
export const URL_API_RENCANA = "/api/presurvei/rencana";

/** Sales yang boleh ditugasi pemanggil (`.../rencana/sales-tersedia`). */
export const URL_SALES_TERSEDIA_RENCANA = `${URL_API_RENCANA}/sales-tersedia`;

/** Rekap rencana vs realisasi (`app/api/presurvei/rencana/rekap`). */
const URL_API_REKAP_RENCANA = "/api/presurvei/rencana/rekap";

/**
 * Awalan `queryKey` seluruh data rencana — daftar, rincian, dan rekap —
 * supaya satu invalidasi setelah buat/ubah/batal menyegarkan semuanya.
 */
export const KUNCI_RENCANA = "presurvei-rencana";

/** Halaman pertama daftar; juga batas bawah jumlah halaman. */
export const HALAMAN_PERTAMA = 1;

const BATAS_TABEL = 20;
const MILIDETIK_PER_HARI = 86_400_000;

/** Kriteria daftar rencana; string kosong berarti tidak menyaring. */
export interface FilterRencana extends RentangTanggal {
  page: number;
  salesId: string;
  status: RencanaStatusTampil | "";
}

/** Filter awal: rentang yang diberikan, tanpa saringan lain. */
export function filterAwalRencana(rentang: RentangTanggal): FilterRencana {
  return { ...rentang, page: HALAMAN_PERTAMA, salesId: "", status: "" };
}

/** URL `GET` daftar rencana; nama param dicocokkan ke `daftarRencanaSchema`. */
export function buildRencanaListUrl(filter: FilterRencana): string {
  const params = new URLSearchParams({
    page: String(filter.page),
    limit: String(BATAS_TABEL),
  });

  for (const [kunci, nilai] of [
    ["dari", filter.dari],
    ["sampai", filter.sampai],
    ["salesId", filter.salesId],
    ["status", filter.status],
  ] as const) {
    if (nilai.trim().length > 0) params.set(kunci, nilai.trim());
  }

  return `${URL_API_RENCANA}?${params.toString()}`;
}

/** Kunci cache daftar rencana untuk satu filter. */
export function kunciQueryDaftarRencana(filter: FilterRencana) {
  return [KUNCI_RENCANA, "daftar", buildRencanaListUrl(filter)] as const;
}

/** Filter setelah kriteria berubah; selalu kembali ke halaman pertama. */
export function filterSetelahUbah(
  lama: FilterRencana,
  perubahan: Partial<Omit<FilterRencana, "page">>,
): FilterRencana {
  return { ...lama, ...perubahan, page: HALAMAN_PERTAMA };
}

/** Filter setelah berpindah halaman; kriteria lain dipertahankan. */
export function filterSetelahPindahHalaman(
  lama: FilterRencana,
  page: number,
): FilterRencana {
  return { ...lama, page };
}

/** URL rincian satu rencana (juga target `PATCH`). */
export function urlRincianRencana(rencanaId: string): string {
  return `${URL_API_RENCANA}/${encodeURIComponent(rencanaId)}`;
}

/** URL pembatalan satu rencana. */
export function urlBatalRencana(rencanaId: string): string {
  return `${urlRincianRencana(rencanaId)}/batal`;
}

/** Kunci cache rincian satu rencana. */
export function kunciQueryRincianRencana(rencanaId: string) {
  return [KUNCI_RENCANA, "rincian", rencanaId] as const;
}

/** URL `GET` rekap untuk satu rentang. */
export function buildRekapRencanaUrl(rentang: RentangTanggal): string {
  const params = new URLSearchParams({
    dari: rentang.dari,
    sampai: rentang.sampai,
  });
  return `${URL_API_REKAP_RENCANA}?${params.toString()}`;
}

/** Kunci cache rekap untuk satu rentang. */
export function kunciQueryRekapRencana(rentang: RentangTanggal) {
  return [KUNCI_RENCANA, "rekap", buildRekapRencanaUrl(rentang)] as const;
}

/**
 * Pesan penolakan rentang rekap, atau null bila sah.
 *
 * Aturannya salinan `rekapRencanaSchema` (tidak diekspor ke klien): server
 * tetap memvalidasi, pemeriksaan di sini mencegah layar menembakkan
 * permintaan yang pasti ditolak 400.
 */
export function periksaRentangRekap(rentang: RentangTanggal): string | null {
  if (rentang.dari.length === 0 || rentang.sampai.length === 0) {
    return "Isi tanggal awal dan akhir rekap.";
  }
  if (rentang.dari > rentang.sampai) {
    return "Tanggal awal harus sebelum tanggal akhir.";
  }

  const selisihHari =
    (Date.parse(rentang.sampai) - Date.parse(rentang.dari)) /
    MILIDETIK_PER_HARI;
  if (selisihHari >= RENTANG_REKAP_HARI_MAKS) {
    return `Rentang rekap maksimal ${RENTANG_REKAP_HARI_MAKS} hari.`;
  }
  return null;
}

/** Urutan tab layar rencana, sekaligus sumber union-nya. */
export const URUTAN_TAB_RENCANA = ["daftar", "rekap"] as const;

export type TabRencana = (typeof URUTAN_TAB_RENCANA)[number];

/** Label tiap tab; `Record` memaksa anggota baru dijawab saat kompilasi. */
export const TAB_RENCANA_LABEL: Record<TabRencana, string> = {
  daftar: "Daftar Rencana",
  rekap: "Rekap",
};
