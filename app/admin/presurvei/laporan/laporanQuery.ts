import { paramPeriode, type Periode } from "../periode";

/** Endpoint laporan pencapaian (`app/api/admin/presurvei/laporan/route.ts`). */
export const URL_API_LAPORAN = "/api/admin/presurvei/laporan";

/** Awalan `queryKey` laporan satu periode. */
export const KUNCI_LAPORAN_PERIODE = "presurvei-laporan-periode";

/** URL `GET` laporan pencapaian satu periode. */
export function buildLaporanUrl(periode: Periode): string {
  return `${URL_API_LAPORAN}?${paramPeriode(periode)}`;
}

/** Kunci cache laporan satu periode. */
export function kunciQueryLaporan(periode: Periode): [string, string] {
  return [KUNCI_LAPORAN_PERIODE, buildLaporanUrl(periode)];
}
