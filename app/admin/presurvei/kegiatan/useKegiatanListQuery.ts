"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import type { KegiatanListItemDto } from "@/modules/presurvei/client";

import { useDaftarSalesPresurvei } from "../useDaftarSalesPresurvei";
import {
  buildKegiatanListUrl,
  filterSetelahPindahHalaman,
  filterSetelahUbah,
  HALAMAN_PERTAMA,
  opsiSales,
  type FilterKegiatan,
} from "./kegiatanListQuery";

interface AmplopDaftar {
  data: KegiatanListItemDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const PESAN_GAGAL = "Gagal memuat daftar kegiatan";

const FILTER_AWAL: FilterKegiatan = {
  page: HALAMAN_PERTAMA,
  userId: "",
  jenis: "",
  hasil: "",
  dariTanggal: "",
  sampaiTanggal: "",
};

/**
 * State filter daftar kegiatan beserta pengambilan datanya.
 *
 * **Tanpa debounce, dan itu keputusan sadar.** Seluruh medan filter layar ini
 * diskret — tiga `<select>` dan dua `<input type="date">` — sehingga satu
 * interaksi pemakai sama dengan satu niat, dan satu request. Tidak ada medan
 * teks bebas yang bisa melahirkan satu request per huruf, jadi debounce hanya
 * akan menambah jeda tanpa menghemat panggilan apa pun. Konsekuensinya: kalau
 * kelak medan teks bebas ditambahkan ke `KegiatanFilters`, keputusan ini wajib
 * ditinjau ulang bersama jebakan skeleton di `PlanningKanbanClient.tsx:45-52`.
 *
 * `untukPeta` hanya mengubah SEBERAPA BANYAK baris yang diambil, bukan state
 * filternya. Ia sengaja jadi parameter alih-alih panggilan hook kedua: tiap
 * panggilan membawa `useState`-nya sendiri, jadi dua panggilan berarti dua
 * himpunan filter yang berjalan sendiri-sendiri — persis kebalikan dari janji
 * "peta dan daftar menyaring himpunan yang sama".
 */
export function useKegiatanListQuery(opsi: { untukPeta?: boolean } = {}) {
  const untukPeta = opsi.untukPeta === true;
  const [filter, setFilter] = useState<FilterKegiatan>(FILTER_AWAL);
  const daftarSales = useDaftarSalesPresurvei();

  const url = useMemo(
    () => buildKegiatanListUrl(filter, { untukPeta }),
    [filter, untukPeta],
  );

  const query = useQuery<AmplopDaftar>({
    queryKey: ["presurvei-kegiatan-list", url],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(PESAN_GAGAL);
      return res.json();
    },
    // Menjaga baris lama tetap tampil saat filter berubah, supaya tabel tidak
    // berkedip kosong di antara dua pengambilan.
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (query.error) toast.error(PESAN_GAGAL);
  }, [query.error]);

  const baris = query.data?.data ?? [];

  const ubahFilter = (perubahan: Partial<Omit<FilterKegiatan, "page">>) =>
    setFilter((lama) => filterSetelahUbah(lama, perubahan));

  const ubahHalaman = (page: number) =>
    setFilter((lama) => filterSetelahPindahHalaman(lama, page));

  return {
    filter,
    ubahFilter,
    ubahHalaman,
    baris,
    salesTersedia: opsiSales(daftarSales, baris, filter.userId),
    meta: query.data?.meta,
    isLoading: query.isPending,
  };
}
