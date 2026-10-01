"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import type { HasilPenilaian } from "@/modules/presurvei/client";

import { paramPeriode, periodeSekarang, type Periode } from "../periode";

/** Endpoint penilaian kinerja (`app/api/presurvei/penilaian/route.ts`). */
export const URL_API_PENILAIAN = "/api/presurvei/penilaian";
const PESAN_GAGAL = "Gagal memuat penilaian kinerja";

/** Periode yang ditampilkan beserta hasil penilaiannya. */
export function usePenilaianQuery() {
  const [periode, setPeriode] = useState<Periode>(() => periodeSekarang());
  const url = `${URL_API_PENILAIAN}?${paramPeriode(periode)}`;

  const query = useQuery<{ data: HasilPenilaian }>({
    queryKey: ["presurvei-penilaian", url],
    queryFn: async () => {
      const respons = await fetch(url);
      if (!respons.ok) throw new Error(PESAN_GAGAL);
      return respons.json();
    },
  });

  useEffect(() => {
    if (query.error) toast.error(PESAN_GAGAL);
  }, [query.error]);

  const ubahPeriode = (perubahan: Partial<Periode>) =>
    setPeriode((lama) => ({ ...lama, ...perubahan }));

  return {
    periode,
    ubahPeriode,
    hasil: query.data?.data ?? null,
    isLoading: query.isPending,
    isError: query.isError,
  };
}
