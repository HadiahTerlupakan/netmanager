"use client";

import { useQuery } from "@tanstack/react-query";

import type { KandidatKepalaSales } from "./kepalaSales";

/** Endpoint kandidat kepala sales (`app/api/admin/presurvei/kepala-sales`). */
const URL_KANDIDAT_KEPALA_SALES = "/api/admin/presurvei/kepala-sales";

const TANPA_KANDIDAT: readonly KandidatKepalaSales[] = Object.freeze([]);

async function ambilKandidat(): Promise<KandidatKepalaSales[]> {
  const respons = await fetch(URL_KANDIDAT_KEPALA_SALES);
  if (!respons.ok) throw new Error("Gagal memuat daftar kepala sales");
  const badan = (await respons.json()) as { data: KandidatKepalaSales[] };
  return badan.data;
}

/**
 * Kandidat kepala sales di tenant pemakai. Dipanggil dari medan yang hanya
 * terpasang untuk user sales, jadi daftar tidak diambil untuk user lain.
 */
export function useKandidatKepalaSales() {
  const query = useQuery({
    queryKey: ["users-kandidat-kepala-sales"],
    queryFn: ambilKandidat,
  });

  return {
    kandidat: query.data ?? TANPA_KANDIDAT,
    isLoading: query.isPending,
    isError: query.isError,
  };
}
