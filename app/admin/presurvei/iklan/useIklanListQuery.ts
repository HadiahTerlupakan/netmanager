"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import type { IklanListItemDto } from "@/modules/presurvei/client";
import { buildIklanListUrl, type FilterIklan } from "./iklanListQuery";

interface AmplopDaftar {
  data: IklanListItemDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const FILTER_AWAL: FilterIklan = {
  page: 1,
  search: "",
  channel: "",
  isAktif: null,
};

/** State filter daftar iklan beserta pengambilan datanya. */
export function useIklanListQuery() {
  const [filter, setFilter] = useState<FilterIklan>(FILTER_AWAL);

  const url = useMemo(() => buildIklanListUrl(filter), [filter]);

  const query = useQuery<AmplopDaftar>({
    queryKey: ["presurvei-iklan-list", url],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Gagal memuat daftar iklan");
      return res.json();
    },
    // Menjaga baris lama tetap tampil saat filter berubah, supaya tabel tidak
    // berkedip kosong di antara dua pengambilan.
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (query.error) toast.error("Gagal memuat daftar iklan");
  }, [query.error]);

  /** Mengubah filter selalu mengembalikan ke halaman satu. */
  const ubahFilter = (perubahan: Partial<Omit<FilterIklan, "page">>) =>
    setFilter((lama) => ({ ...lama, ...perubahan, page: 1 }));

  const ubahHalaman = (page: number) =>
    setFilter((lama) => ({ ...lama, page }));

  return {
    filter,
    ubahFilter,
    ubahHalaman,
    baris: query.data?.data ?? [],
    meta: query.data?.meta,
    isLoading: query.isPending,
  };
}
