"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { periodeSekarang, type Periode } from "./periode";

/** Pembentuk permintaan satu jenis data berperiode. */
export interface OpsiDataPeriode {
  /** Kunci cache periode; wajib memuat periode supaya tiap bulan terpisah. */
  kunciQuery: (periode: Periode) => readonly unknown[];
  buatUrl: (periode: Periode) => string;
  pesanGagal: string;
}

/** Referensi tunggal untuk "belum ada data", supaya `useMemo` pemakai tidak terpicu tiap render. */
const TANPA_DATA: readonly never[] = Object.freeze([] as never[]);

/**
 * Periode yang sedang ditampilkan beserta data amplop `{ data: T[] }` untuk
 * periode itu. Dipakai layar target dan laporan, yang berbeda hanya pada
 * endpoint dan kunci cache.
 */
export function useDataPeriode<T>({
  kunciQuery,
  buatUrl,
  pesanGagal,
}: OpsiDataPeriode) {
  const [periode, setPeriode] = useState<Periode>(() => periodeSekarang());

  const query = useQuery<{ data: T[] }>({
    queryKey: kunciQuery(periode),
    queryFn: async () => {
      const respons = await fetch(buatUrl(periode));
      if (!respons.ok) throw new Error(pesanGagal);
      return respons.json();
    },
  });

  useEffect(() => {
    if (query.error) toast.error(pesanGagal);
  }, [query.error, pesanGagal]);

  const ubahPeriode = (perubahan: Partial<Periode>) =>
    setPeriode((lama) => ({ ...lama, ...perubahan }));

  const data: readonly T[] = query.data?.data ?? TANPA_DATA;

  return {
    periode,
    ubahPeriode,
    data,
    isLoading: query.isPending,
    isError: query.isError,
  };
}
