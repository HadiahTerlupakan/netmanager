"use client";

import { useQuery } from "@tanstack/react-query";

import type { RincianRencanaDto } from "@/modules/presurvei/client";

import { ambilDataRencana } from "./ambilDataRencana";
import { kunciQueryRincianRencana, urlRincianRencana } from "./rencanaQuery";

/** Rincian satu rencana beserta laporan kunjungannya. */
export function useRincianRencanaQuery(rencanaId: string) {
  const query = useQuery({
    queryKey: kunciQueryRincianRencana(rencanaId),
    queryFn: () =>
      ambilDataRencana<RincianRencanaDto>(
        urlRincianRencana(rencanaId),
        "Gagal memuat rincian rencana",
      ),
  });

  return {
    rincian: query.data,
    isLoading: query.isPending,
    isError: query.isError,
  };
}
