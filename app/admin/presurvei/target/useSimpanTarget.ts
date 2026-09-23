"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { formatApiError } from "@/lib/utils/api-response-parser";

import { kunciQueryTarget, URL_API_TARGET } from "./periodeQuery";
import type { MuatanTarget } from "./targetFormState";

const PESAN_GAGAL_SIMPAN = "Gagal menyimpan target";

/**
 * Pengiriman target ke `POST /api/admin/presurvei/target`.
 *
 * Satu jalur untuk menetapkan maupun mengubah: menyimpan sales dan periode
 * yang sama menimpa baris lama (`TargetRepository.simpan`,
 * `modules/presurvei/repositories/TargetRepository.ts:45-63`).
 */
export function useSimpanTarget(onBerhasil: () => void) {
  const queryClient = useQueryClient();
  const [isMenyimpan, setIsMenyimpan] = useState(false);

  const simpan = async (muatan: MuatanTarget) => {
    setIsMenyimpan(true);
    try {
      const respons = await fetch(URL_API_TARGET, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(muatan),
      });
      const badan: unknown = await respons.json().catch((): null => null);

      if (!respons.ok) {
        toast.error(formatApiError(badan, PESAN_GAGAL_SIMPAN));
        return;
      }

      toast.success("Target tersimpan");

      // Kunci dibentuk dari periode muatan: periode yang benar-benar
      // disimpan.
      queryClient.invalidateQueries({
        queryKey: kunciQueryTarget({
          tahun: muatan.periodeTahun,
          bulan: muatan.periodeBulan,
        }),
      });
      onBerhasil();
    } catch {
      toast.error(PESAN_GAGAL_SIMPAN);
    } finally {
      setIsMenyimpan(false);
    }
  };

  return { simpan, isMenyimpan };
}
