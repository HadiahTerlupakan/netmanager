"use client";

import type { TargetDto } from "@/modules/presurvei/client";

import { useDataPeriode } from "../useDataPeriode";
import { buildTargetUrl, kunciQueryTarget } from "./periodeQuery";

/** Periode yang sedang ditampilkan beserta target seluruh sales di periode itu. */
export function useTargetPeriode() {
  const { data, ...sisa } = useDataPeriode<TargetDto>({
    kunciQuery: kunciQueryTarget,
    buatUrl: buildTargetUrl,
    pesanGagal: "Gagal memuat target",
  });

  return { ...sisa, daftarTarget: data };
}
