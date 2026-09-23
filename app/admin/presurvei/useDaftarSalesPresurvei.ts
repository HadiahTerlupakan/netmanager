"use client";

import { useQuery } from "@tanstack/react-query";

import type { SalesPresurveiDto } from "@/modules/presurvei/client";

/** Endpoint daftar sales (`app/api/admin/presurvei/sales/route.ts`). */
export const URL_DAFTAR_SALES_PRESURVEI = "/api/admin/presurvei/sales";

const KUNCI_DAFTAR_SALES = "presurvei-daftar-sales";

/** Referensi tunggal untuk "belum ada data", supaya tidak lahir array baru tiap render. */
const TANPA_SALES: readonly SalesPresurveiDto[] = Object.freeze([]);

async function ambilDaftarSales(): Promise<{ data: SalesPresurveiDto[] }> {
  const respons = await fetch(URL_DAFTAR_SALES_PRESURVEI);
  if (!respons.ok) throw new Error("Gagal memuat daftar sales");
  return respons.json();
}

/**
 * Sales aktif di tenant pemakai, untuk dropdown filter dan layar target.
 *
 * Selama belum tiba — atau bila gagal — mengembalikan daftar kosong, bukan
 * melempar: pemakainya (`opsiSales`) tetap punya pilihan dari baris yang
 * sedang tampil, jadi layar tidak kehilangan fungsi filternya.
 */
export function useDaftarSalesPresurvei(): readonly SalesPresurveiDto[] {
  const query = useQuery({
    queryKey: [KUNCI_DAFTAR_SALES],
    queryFn: ambilDaftarSales,
  });

  return query.data?.data ?? TANPA_SALES;
}
