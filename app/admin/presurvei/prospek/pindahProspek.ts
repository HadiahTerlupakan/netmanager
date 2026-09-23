import type { QueryState } from "@tanstack/react-query";

import {
  PROSPEK_STATUS_CONFIG,
  type ProspekListItemDto,
  type ProspekStatus,
} from "@/modules/presurvei/client";

/** URL `PATCH` satu prospek (`app/api/presurvei/prospek/[id]/route.ts`). */
export function buildUbahProspekUrl(prospekId: string): string {
  return `/api/presurvei/prospek/${encodeURIComponent(prospekId)}`;
}

/** Apakah kartu `prospekId` ada di salah satu halaman yang sudah dimuat. */
export function isKartuTermuat(
  perHalaman: (ProspekListItemDto[] | undefined)[],
  prospekId: string,
): boolean {
  return perHalaman.some((halaman) =>
    (halaman ?? []).some((item) => item.id === prospekId),
  );
}

/** Bagian state query satu halaman kolom yang dibaca setelah invalidasi. */
export type StateHalamanKolom = Pick<
  QueryState,
  "status" | "isInvalidated" | "fetchStatus"
>;

/**
 * Apakah halaman ini benar-benar sudah diambil ulang dengan sukses.
 *
 * `invalidateQueries` tetap resolve walau refetch-nya gagal (`.catch(noop)`,
 * `node_modules/@tanstack/query-core/src/queryClient.ts:328-330`) atau
 * tertahan offline (`:331-333`). Refetch gagal meninggalkan data lama dengan
 * `isInvalidated: true` (`node_modules/@tanstack/query-core/src/query.ts:670-684`);
 * refetch sukses mengembalikannya ke `false` (`query.ts:731-738`).
 */
export function isHalamanSegar(state: StateHalamanKolom): boolean {
  return (
    state.status === "success" &&
    !state.isInvalidated &&
    state.fetchStatus === "idle"
  );
}

/** Satu halaman aktif kolom tujuan setelah invalidasi. */
export interface HalamanTujuan {
  kartu: ProspekListItemDto[] | undefined;
  isSegar: boolean;
}

/** Keberadaan kartu yang baru dipindah di kolom tujuannya. */
export type NasibKartuPindah =
  | "tampil"
  | "di-luar-muatan"
  | "kolom-tak-termuat";

/**
 * Di mana kartu yang baru dipindah berada dari sudut pandang pemakai.
 *
 * - `tampil`: ada di salah satu halaman yang dirender.
 * - `di-luar-muatan`: semua halaman kolom tujuan sudah diambil ulang dan
 *   kartunya tidak ada — kolom diurutkan `createdAt desc`, bukan waktu pindah
 *   (`modules/presurvei/repositories/ProspekRepository.ts:45-47`), jadi
 *   prospek lama mendarat di halaman yang belum dimuat.
 * - `kolom-tak-termuat`: ada halaman yang gagal atau belum diambil ulang, atau
 *   kolom tujuan tidak dirender sama sekali (mis. sakelar kolom mati
 *   dimatikan selama PATCH berjalan). Menyimpulkan "di luar muatan" di sini
 *   menyebut penyebab yang salah.
 */
export function nasibKartuSetelahPindah(
  halamanTujuan: HalamanTujuan[],
  prospekId: string,
): NasibKartuPindah {
  if (
    isKartuTermuat(
      halamanTujuan.map((halaman) => halaman.kartu),
      prospekId,
    )
  ) {
    return "tampil";
  }
  const isSemuaSegar =
    halamanTujuan.length > 0 &&
    halamanTujuan.every((halaman) => halaman.isSegar);
  return isSemuaSegar ? "di-luar-muatan" : "kolom-tak-termuat";
}

/**
 * Pesan setelah status prospek berhasil dipindah, sesuai nasib kartunya.
 *
 * Dua pesan selain `tampil` ada supaya kartu yang lenyap dari kedua kolom
 * tidak dikira gagal dipindah, dan supaya penyebab yang disebut benar.
 */
export function pesanSetelahPindah(
  tujuan: ProspekStatus,
  nasib: NasibKartuPindah,
): string {
  const label = PROSPEK_STATUS_CONFIG[tujuan].label;
  switch (nasib) {
    case "tampil":
      return `Prospek dipindah ke ${label}`;
    case "di-luar-muatan":
      return `Prospek dipindah ke ${label}. Kartunya tidak tampil karena berada di luar kartu yang sudah dimuat kolom ${label}.`;
    case "kolom-tak-termuat":
      return `Status prospek sudah dipindah ke ${label}, tetapi kolom ${label} belum bisa dimuat ulang, jadi kartunya belum tampil.`;
  }
}
