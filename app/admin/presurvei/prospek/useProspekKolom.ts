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
  cariHalamanGagal,
  daftarHalaman,
  gabungKartu,
  HALAMAN_PERTAMA,
  halamanTermuat,
  KUNCI_KOLOM_PROSPEK,
  muatanSetelahMuatLebih,
  ringkasJumlahKolom,
  tentukanLangkahMuat,
  type MetaKolom,
  type MuatanKolom,
} from "./prospekKolomQuery";

/** Amplop satu halaman kolom papan. */
export interface AmplopKolom {
  data: ProspekListItemDto[];
  meta: MetaKolom & { page: number; limit: number };
}

const PESAN_GAGAL = "Gagal memuat papan prospek";

/**
 * Id toast bersama seluruh kolom.
 *
 * Papan memasang lima sampai tujuh kolom sekaligus, dan saat server menolak
 * semuanya gagal bersamaan. `toast.error` men-dispatch UPSERT, yang di reducer
 * `react-hot-toast` menjadi UPDATE bila id-nya sudah ada dan ADD bila belum
 * (`node_modules/react-hot-toast/dist/index.mjs`, cabang `case 2`) — jadi
 * toast ber-id sama diperbarui alih-alih ditumpuk.
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
 * Kunci dan pengambil satu halaman kolom papan.
 *
 * Satu-satunya sumber pasangan ini: dashboard (`useCorongDashboard`) memakai
 * cache halaman pertama yang sama, jadi invalidasi papan setelah kartu
 * dipindahkan ikut menyegarkan angka corong. Kunci yang sama dengan pengambil
 * berbeda akan menaruh dua bentuk data di satu entri cache.
 */
export function opsiQueryHalamanKolom(status: ProspekStatus, page: number) {
  return {
    queryKey: [KUNCI_KOLOM_PROSPEK, status, page],
    queryFn: () => ambilHalamanKolom(status, page),
  };
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
    queries: daftarHalaman(halaman).map((page) =>
      opsiQueryHalamanKolom(status, page),
    ),
  });

  const halamanGagal = cariHalamanGagal(
    hasilPerHalaman.map((hasil) => hasil.error !== null),
  );

  useEffect(() => {
    if (halamanGagal !== null) {
      toast.error(PESAN_GAGAL, { id: ID_TOAST_GAGAL });
    }
  }, [halamanGagal]);

  const { total, adaLagi } = ringkasJumlahKolom(
    hasilPerHalaman.map((hasil) => ({
      meta: hasil.data?.meta,
      diperbaruiPada: hasil.dataUpdatedAt,
    })),
    halaman,
  );

  /**
   * Aksi tombol kaki kolom: coba ulang halaman gagal pertama bila ada, baru
   * maju ke halaman berikutnya bila semuanya berhasil. Satu jalan pemulihan
   * untuk kolom yang gagal dari awal maupun yang gagal di tengah.
   */
  const muatLebih = () => {
    const langkah = tentukanLangkahMuat(halamanGagal);
    if (langkah.jenis === "coba-lagi") {
      void hasilPerHalaman[langkah.halaman - 1].refetch();
      return;
    }
    setMuatan((lama) => muatanSetelahMuatLebih(lama, status));
  };

  const isMencobaLagi =
    halamanGagal !== null && hasilPerHalaman[halamanGagal - 1].isFetching;

  return {
    kartu: gabungKartu(hasilPerHalaman.map((hasil) => hasil.data?.data)),
    total,
    adaLagi,
    halamanGagal,
    isLoading: hasilPerHalaman[0].isPending,
    isMemuatLebih:
      isMencobaLagi ||
      (halaman > HALAMAN_PERTAMA && hasilPerHalaman[halaman - 1].isPending),
    muatLebih,
  };
}
