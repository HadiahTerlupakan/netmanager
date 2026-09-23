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

/** Keadaan pengambilan daftar sales, dari sudut pandang pemakainya. */
export type StatusDaftarSales = "memuat" | "gagal" | "siap";

/** Daftar sales beserta keadaan pengambilannya. */
export interface KeadaanDaftarSales {
  status: StatusDaftarSales;
  daftar: readonly SalesPresurveiDto[];
}

/**
 * Sales aktif di tenant pemakai beserta keadaan pengambilannya.
 *
 * Untuk pemakai yang harus membedakan "gagal dimuat" dari "memang tidak ada
 * sales" — pemilih sales di modal target. Data yang sudah pernah tiba tetap
 * `siap` walau muat ulang di latar gagal: React Query mempertahankan `data`
 * lama bersama `isError`, dan daftar itu masih sah untuk dipilih.
 */
export function useKeadaanDaftarSalesPresurvei(): KeadaanDaftarSales {
  const query = useQuery({
    queryKey: [KUNCI_DAFTAR_SALES],
    queryFn: ambilDaftarSales,
  });

  const daftar = query.data?.data;
  if (Array.isArray(daftar)) return { status: "siap", daftar };
  if (query.isError) return { status: "gagal", daftar: TANPA_SALES };
  return { status: "memuat", daftar: TANPA_SALES };
}

/**
 * Sales aktif di tenant pemakai, untuk dropdown filter.
 *
 * Selama belum tiba — atau bila gagal — mengembalikan daftar kosong, bukan
 * melempar: pemakainya (`opsiSales`) tetap punya pilihan dari baris yang
 * sedang tampil, jadi layar tidak kehilangan fungsi filternya.
 */
export function useDaftarSalesPresurvei(): readonly SalesPresurveiDto[] {
  return useKeadaanDaftarSalesPresurvei().daftar;
}
