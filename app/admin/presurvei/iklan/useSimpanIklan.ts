"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { formatApiError } from "@/lib/utils/api-response-parser";

import {
  URL_DAFTAR_IKLAN,
  type MuatanBuatIklan,
  type MuatanUbahIklan,
  type OpsiSimpanIklan,
} from "./iklanFormState";

/** Awalan `queryKey` daftar iklan; lihat `useIklanListQuery`. */
const KUNCI_DAFTAR_IKLAN = "presurvei-iklan-list";

/**
 * Pengiriman muatan kampanye ke API, dipakai mode buat maupun ubah.
 *
 * Keduanya berbeda hanya pada endpoint, metode, dan teks notifikasinya —
 * sisanya (status menyimpan, penerjemahan error server, invalidasi cache,
 * kembali ke daftar) identik dan hanya ditulis di sini.
 */
export function useSimpanIklan({
  url,
  method,
  pesanSukses,
  pesanGagal,
}: OpsiSimpanIklan) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isMenyimpan, setIsMenyimpan] = useState(false);

  const simpan = async (muatan: MuatanBuatIklan | MuatanUbahIklan) => {
    setIsMenyimpan(true);
    try {
      const respons = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(muatan),
      });
      const badan = await respons.json();

      if (!respons.ok) {
        toast.error(formatApiError(badan, pesanGagal));
        return;
      }

      toast.success(pesanSukses);

      // Query di-cache 30 detik (`staleTime` di `session-provider.tsx`). Tanpa
      // invalidasi, pemakai kembali ke daftar dan tidak menemukan kampanye
      // yang baru saja disimpannya — lalu menyimpannya sekali lagi. Key detail
      // ikut dibuang supaya form ubah tidak memuat ulang salinan lama.
      queryClient.invalidateQueries({ queryKey: [KUNCI_DAFTAR_IKLAN] });
      queryClient.invalidateQueries({ queryKey: [url] });

      router.push(URL_DAFTAR_IKLAN);
    } catch {
      toast.error(pesanGagal);
    } finally {
      setIsMenyimpan(false);
    }
  };

  return { simpan, isMenyimpan };
}
