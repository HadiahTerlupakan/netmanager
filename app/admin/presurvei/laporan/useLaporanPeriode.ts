"use client";

import type { BarisLaporanDto } from "@/modules/presurvei/client";

import { useDataPeriode } from "../useDataPeriode";
import { buildLaporanUrl, kunciQueryLaporan } from "./laporanQuery";

/** Periode yang sedang ditampilkan beserta laporan pencapaiannya. */
export function useLaporanPeriode() {
  const { data, ...sisa } = useDataPeriode<BarisLaporanDto>({
    kunciQuery: kunciQueryLaporan,
    buatUrl: buildLaporanUrl,
    pesanGagal: "Gagal memuat laporan",
  });

  return { ...sisa, daftarLaporan: data };
}
