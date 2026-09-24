"use client";

import { useQuery } from "@tanstack/react-query";

import type { DepartemenPresurveiDto } from "@/modules/presurvei/client";

/** Endpoint daftar departemen (`app/api/admin/presurvei/departemen/route.ts`). */
export const URL_DAFTAR_DEPARTEMEN_PRESURVEI =
  "/api/admin/presurvei/departemen";

const KUNCI_DAFTAR_DEPARTEMEN = "presurvei-daftar-departemen";

/** Referensi tunggal untuk "belum ada data", supaya tidak lahir array baru tiap render. */
const TANPA_DEPARTEMEN: readonly DepartemenPresurveiDto[] = Object.freeze([]);

async function ambilDaftarDepartemen(): Promise<{
  data: DepartemenPresurveiDto[];
}> {
  const respons = await fetch(URL_DAFTAR_DEPARTEMEN_PRESURVEI);
  if (!respons.ok) throw new Error("Gagal memuat daftar departemen");
  return respons.json();
}

/**
 * Departemen di tenant pemakai, untuk dropdown filter "Departemen".
 *
 * Selama belum tiba — atau bila gagal — mengembalikan daftar kosong, bukan
 * melempar: dropdown tetap menawarkan "Semua departemen", dan medan filter
 * lain tidak ikut lumpuh. Pola yang sama dengan `useDaftarSalesPresurvei`.
 */
export function useDaftarDepartemenPresurvei(): readonly DepartemenPresurveiDto[] {
  const query = useQuery({
    queryKey: [KUNCI_DAFTAR_DEPARTEMEN],
    queryFn: ambilDaftarDepartemen,
  });

  const daftar = query.data?.data;
  return Array.isArray(daftar) ? daftar : TANPA_DEPARTEMEN;
}
