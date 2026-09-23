import { paramPeriode, type Periode } from "../periode";

/** Endpoint target presurvei (`app/api/admin/presurvei/target/route.ts`). */
export const URL_API_TARGET = "/api/admin/presurvei/target";

/** Awalan `queryKey` target satu periode. */
export const KUNCI_TARGET_PERIODE = "presurvei-target-periode";

/** URL `GET` target satu periode. */
export function buildTargetUrl(periode: Periode): string {
  return `${URL_API_TARGET}?${paramPeriode(periode)}`;
}

/** Kunci cache target satu periode; dipakai pengambil maupun invalidasi. */
export function kunciQueryTarget(periode: Periode): [string, string] {
  return [KUNCI_TARGET_PERIODE, buildTargetUrl(periode)];
}
