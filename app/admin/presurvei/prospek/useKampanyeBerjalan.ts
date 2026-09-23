"use client";

import { useQuery } from "@tanstack/react-query";

import {
  ringkasPilihanKampanye,
  URL_PILIHAN_KAMPANYE,
  type AmplopPilihanKampanye,
  type RingkasanPilihanKampanye,
} from "./prospekFormState";

/**
 * Kunci cache sendiri, bukan URL-nya: `useApi` memakai URL mentah sebagai
 * kunci dan menyimpan data yang sudah dibuka amplopnya, jadi berbagi kunci
 * dengannya akan mencampur dua bentuk data di satu entri cache.
 */
const KUNCI_PILIHAN_KAMPANYE = "presurvei-prospek-pilihan-kampanye";

async function ambilPilihanKampanye(): Promise<AmplopPilihanKampanye> {
  const respons = await fetch(URL_PILIHAN_KAMPANYE);
  if (!respons.ok) throw new Error("Gagal memuat daftar kampanye");
  return respons.json();
}

/**
 * Kampanye berjalan untuk pemilih iklan, beserta apakah daftarnya terpotong.
 *
 * Memakai `useQuery` langsung, bukan `useApi`: `useApi` membuka amplop dan
 * membuang `meta` (`lib/hooks/useApi.ts:28-38`), padahal `meta.total` satu-
 * satunya cara mengetahui bahwa daftar ini tidak lengkap.
 *
 * `isBolehMemuat` false berarti permintaan tidak pernah dikirim — pemakai
 * tanpa `presurvei_iklan:read` akan menerima 403.
 */
export function useKampanyeBerjalan(isBolehMemuat: boolean): {
  ringkasan: RingkasanPilihanKampanye | undefined;
  isLoading: boolean;
  isGagal: boolean;
} {
  const query = useQuery({
    queryKey: [KUNCI_PILIHAN_KAMPANYE],
    queryFn: ambilPilihanKampanye,
    enabled: isBolehMemuat,
  });

  return {
    ringkasan:
      query.data === undefined ? undefined : ringkasPilihanKampanye(query.data),
    isLoading: query.isLoading,
    isGagal: query.error !== null,
  };
}
