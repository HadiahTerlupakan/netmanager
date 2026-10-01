"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import type { BarisRekapRencanaDto } from "@/modules/presurvei/client";

import { ambilDataRencana } from "./ambilDataRencana";
import {
  buildRekapRencanaUrl,
  kunciQueryRekapRencana,
  periksaRentangRekap,
} from "./rencanaQuery";
import { rentangBulanIni, type RentangTanggal } from "./rentangTanggal";

/** Isi `data` `GET /api/presurvei/rencana/rekap`. */
interface RekapRencana {
  hariIni: string;
  baris: BarisRekapRencanaDto[];
}

const PESAN_GAGAL = "Gagal memuat rekap rencana";

const TANPA_BARIS: readonly BarisRekapRencanaDto[] = Object.freeze([]);

/**
 * Rentang rekap (awal: bulan berjalan) beserta rekap per sales-nya.
 * Rentang yang pasti ditolak server tidak dikirim; pesannya dikembalikan
 * sebagai `pesanRentang` untuk ditampilkan di layar.
 */
export function useRekapRencanaQuery() {
  const [rentang, setRentang] = useState<RentangTanggal>(() =>
    rentangBulanIni(),
  );
  const pesanRentang = periksaRentangRekap(rentang);

  const query = useQuery({
    queryKey: kunciQueryRekapRencana(rentang),
    queryFn: () =>
      ambilDataRencana<RekapRencana>(
        buildRekapRencanaUrl(rentang),
        PESAN_GAGAL,
      ),
    enabled: pesanRentang === null,
  });

  useEffect(() => {
    if (query.error) toast.error(PESAN_GAGAL);
  }, [query.error]);

  const ubahRentang = (perubahan: Partial<RentangTanggal>) =>
    setRentang((lama) => ({ ...lama, ...perubahan }));

  return {
    rentang,
    ubahRentang,
    pesanRentang,
    baris: query.data?.baris ?? TANPA_BARIS,
    isLoading: pesanRentang === null && query.isPending,
    isError: query.isError,
  };
}
