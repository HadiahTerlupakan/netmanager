"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import type { TargetDto } from "@/modules/presurvei/client";

import {
  buildTargetUrl,
  kunciQueryTarget,
  periodeSekarang,
  type Periode,
} from "./periodeQuery";

const PESAN_GAGAL_MUAT = "Gagal memuat target";

/** Referensi tunggal untuk "belum ada data", supaya `useMemo` pemakai tidak terpicu tiap render. */
const TANPA_TARGET: readonly TargetDto[] = Object.freeze([]);

/** Periode yang sedang ditampilkan beserta target seluruh sales di periode itu. */
export function useTargetPeriode() {
  const [periode, setPeriode] = useState<Periode>(() => periodeSekarang());

  const query = useQuery<{ data: TargetDto[] }>({
    queryKey: kunciQueryTarget(periode),
    queryFn: async () => {
      const respons = await fetch(buildTargetUrl(periode));
      if (!respons.ok) throw new Error(PESAN_GAGAL_MUAT);
      return respons.json();
    },
  });

  useEffect(() => {
    if (query.error) toast.error(PESAN_GAGAL_MUAT);
  }, [query.error]);

  const ubahPeriode = (perubahan: Partial<Periode>) =>
    setPeriode((lama) => ({ ...lama, ...perubahan }));

  return {
    periode,
    ubahPeriode,
    daftarTarget: query.data?.data ?? TANPA_TARGET,
    isLoading: query.isPending,
    isError: query.isError,
  };
}
