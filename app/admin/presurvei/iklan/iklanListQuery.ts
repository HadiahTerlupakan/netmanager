import type { IklanChannel } from "@/modules/presurvei/client";

/** Jumlah baris per halaman daftar iklan. */
const BATAS_PER_HALAMAN = 20;

/** State filter daftar iklan; string kosong dan null berarti "tidak menyaring". */
export interface FilterIklan {
  page: number;
  search: string;
  channel: IklanChannel | "";
  isAktif: boolean | null;
}

/**
 * URL daftar iklan dari state filter.
 *
 * Dipisahkan dari komponen supaya bisa diuji langsung: repo ini tidak punya
 * DOM palsu, jadi logika yang tertinggal di dalam komponen tidak akan teruji.
 */
export function buildIklanListUrl(filter: FilterIklan): string {
  const params = new URLSearchParams({
    page: String(filter.page),
    limit: String(BATAS_PER_HALAMAN),
  });

  if (filter.search.trim().length > 0) {
    params.set("search", filter.search.trim());
  }
  if (filter.channel !== "") {
    params.set("channel", filter.channel);
  }
  // Perbandingan eksplisit terhadap null, bukan truthiness: `false` adalah
  // pilihan filter yang sah ("hanya yang nonaktif").
  if (filter.isAktif !== null) {
    params.set("isAktif", String(filter.isAktif));
  }

  return `/api/admin/presurvei/iklan?${params.toString()}`;
}
