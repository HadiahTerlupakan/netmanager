"use client";

import { useQuery } from "@tanstack/react-query";

import type { SalesPresurveiDto } from "@/modules/presurvei/client";

import { ambilDataRencana } from "./ambilDataRencana";
import { KUNCI_RENCANA, URL_SALES_TERSEDIA_RENCANA } from "./rencanaQuery";

/** Keadaan pengambilan daftar sales yang boleh ditugasi. */
export type StatusSalesTersedia = "nonaktif" | "memuat" | "gagal" | "siap";

export interface KeadaanSalesTersedia {
  status: StatusSalesTersedia;
  daftar: readonly SalesPresurveiDto[];
}

const TANPA_SALES: readonly SalesPresurveiDto[] = Object.freeze([]);

/**
 * Sales yang boleh ditugasi pemakai (admin: seluruh tenant; kepala sales:
 * dirinya + timnya). Endpoint-nya bergerbang `presurvei_rencana:create`,
 * jadi `isAktif` wajib false bagi pemakai tanpa izin itu — tanpanya layar
 * baca-saja menembakkan permintaan yang pasti 403.
 */
export function useSalesTersediaQuery(isAktif: boolean): KeadaanSalesTersedia {
  const query = useQuery({
    queryKey: [KUNCI_RENCANA, "sales-tersedia"],
    queryFn: () =>
      ambilDataRencana<SalesPresurveiDto[]>(
        URL_SALES_TERSEDIA_RENCANA,
        "Gagal memuat daftar sales",
      ),
    enabled: isAktif,
  });

  if (!isAktif) return { status: "nonaktif", daftar: TANPA_SALES };
  if (Array.isArray(query.data)) return { status: "siap", daftar: query.data };
  if (query.isError) return { status: "gagal", daftar: TANPA_SALES };
  return { status: "memuat", daftar: TANPA_SALES };
}
