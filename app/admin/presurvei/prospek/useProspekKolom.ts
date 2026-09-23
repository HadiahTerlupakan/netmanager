"use client";

import { useQueries } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import type {
  ProspekListItemDto,
  ProspekStatus,
} from "@/modules/presurvei/client";
import {
  buildProspekKolomUrl,
  daftarHalaman,
  gabungKartu,
  HALAMAN_PERTAMA,
  halamanTermuat,
  KUNCI_KOLOM_PROSPEK,
  muatanSetelahMuatLebih,
  ringkasJumlahKolom,
  type MetaKolom,
  type MuatanKolom,
} from "./prospekKolomQuery";

interface AmplopKolom {
  data: ProspekListItemDto[];
  meta: MetaKolom & { page: number; limit: number };
}

const PESAN_GAGAL = "Gagal memuat papan prospek";

/**
 * Id toast bersama seluruh kolom.
 *
 * Papan memasang lima sampai tujuh kolom sekaligus, dan saat server menolak
 * semuanya gagal bersamaan. Toast ber-id sama diperbarui alih-alih ditumpuk —
 * reducer `react-hot-toast` mengubah ADD jadi UPDATE bila id-nya sudah ada
 * (`node_modules/react-hot-toast/dist/index.mjs`, cabang `case 2`).
 */
const ID_TOAST_GAGAL = "presurvei-prospek-kolom-gagal";

async function ambilHalamanKolom(
  status: ProspekStatus,
  page: number,
): Promise<AmplopKolom> {
  const res = await fetch(buildProspekKolomUrl(status, page));
  if (!res.ok) throw new Error(PESAN_GAGAL);
  return res.json();
}

/**
 * Isi satu kolom papan prospek, dengan "muat lebih" yang menambah kartu.
 *
 * Satu query per halaman yang sudah dimuat, bukan satu query yang halamannya
 * digeser: kartu halaman sebelumnya tetap berasal dari cache-nya sendiri, jadi
 * "muat lebih" menambah alih-alih menukar. Yang disimpan di `useState` adalah
 * seberapa jauh kolom sudah dimuat, bukan salinan kartunya — salinan akan
 * basi begitu query kolom di-invalidate setelah kartu dipindahkan (Task 12),
 * sedangkan query per halaman ikut diambil ulang semuanya karena semuanya
 * masih aktif, dan `invalidateQueries` secara bawaan mengambil ulang query
 * aktif (`node_modules/@tanstack/query-core/src/queryClient.ts:307`).
 *
 * Kuncinya `[KUNCI_KOLOM_PROSPEK, status, page]`, sehingga invalidasi dengan
 * awalan `[KUNCI_KOLOM_PROSPEK, status]` mengenai seluruh halaman satu kolom.
 */
export function useProspekKolom(status: ProspekStatus) {
  const [muatan, setMuatan] = useState<MuatanKolom>({
    status,
    halaman: HALAMAN_PERTAMA,
  });
  const halaman = halamanTermuat(muatan, status);

  const hasilPerHalaman = useQueries({
    queries: daftarHalaman(halaman).map((page) => ({
      queryKey: [KUNCI_KOLOM_PROSPEK, status, page],
      queryFn: () => ambilHalamanKolom(status, page),
    })),
  });

  const isGagal = hasilPerHalaman.some((hasil) => hasil.error !== null);

  useEffect(() => {
    if (isGagal) toast.error(PESAN_GAGAL, { id: ID_TOAST_GAGAL });
  }, [isGagal]);

  const { total, adaLagi } = ringkasJumlahKolom(
    hasilPerHalaman.map((hasil) => hasil.data?.meta),
    halaman,
  );

  return {
    kartu: gabungKartu(hasilPerHalaman.map((hasil) => hasil.data?.data)),
    total,
    adaLagi,
    isLoading: hasilPerHalaman[0].isPending,
    isMemuatLebih:
      halaman > HALAMAN_PERTAMA && hasilPerHalaman[halaman - 1].isPending,
    muatLebih: () => setMuatan((lama) => muatanSetelahMuatLebih(lama, status)),
  };
}
