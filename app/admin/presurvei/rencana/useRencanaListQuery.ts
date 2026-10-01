"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import type { RencanaDto } from "@/modules/presurvei/client";

import {
  buildRencanaListUrl,
  filterAwalRencana,
  filterSetelahPindahHalaman,
  filterSetelahUbah,
  kunciQueryDaftarRencana,
  type FilterRencana,
} from "./rencanaQuery";
import { rentangMingguIni } from "./rentangTanggal";

/** Amplop `apiPaginated` (`lib/api-response.ts`). */
interface AmplopDaftarRencana {
  data: RencanaDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const PESAN_GAGAL = "Gagal memuat daftar rencana";

/** Referensi tunggal "belum ada data", supaya tidak lahir array baru tiap render. */
const TANPA_RENCANA: readonly RencanaDto[] = Object.freeze([]);

/**
 * State filter daftar rencana beserta pengambilan datanya. Rentang awal
 * pekan berjalan (Senin–Minggu, waktu lokal). Tanpa debounce: seluruh medan
 * filter diskret (select dan tanggal), satu interaksi satu permintaan.
 */
export function useRencanaListQuery() {
  const [filter, setFilter] = useState<FilterRencana>(() =>
    filterAwalRencana(rentangMingguIni()),
  );

  const query = useQuery<AmplopDaftarRencana>({
    queryKey: kunciQueryDaftarRencana(filter),
    queryFn: async () => {
      const respons = await fetch(buildRencanaListUrl(filter));
      if (!respons.ok) throw new Error(PESAN_GAGAL);
      return respons.json();
    },
    // Baris lama tetap tampil saat filter berubah, supaya tabel tidak berkedip.
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (query.error) toast.error(PESAN_GAGAL);
  }, [query.error]);

  const ubahFilter = (perubahan: Partial<Omit<FilterRencana, "page">>) =>
    setFilter((lama) => filterSetelahUbah(lama, perubahan));

  const ubahHalaman = (page: number) =>
    setFilter((lama) => filterSetelahPindahHalaman(lama, page));

  return {
    filter,
    ubahFilter,
    ubahHalaman,
    baris: query.data?.data ?? TANPA_RENCANA,
    meta: query.data?.meta,
    isLoading: query.isPending,
    isError: query.isError,
  };
}
