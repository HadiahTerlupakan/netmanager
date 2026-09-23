import type { IklanChannel } from "@/modules/presurvei/client";

/** Jumlah baris per halaman daftar iklan. */
const BATAS_PER_HALAMAN = 20;

/** Halaman pertama daftar; juga batas bawah jumlah halaman. */
export const HALAMAN_PERTAMA = 1;

/** State filter daftar iklan; string kosong dan null berarti "tidak menyaring". */
export interface FilterIklan {
  page: number;
  search: string;
  channel: IklanChannel | "";
  isAktif: boolean | null;
}

/**
 * URL daftar iklan dari state filter.
 *
 * Dipisahkan dari komponen supaya bisa diuji langsung sebagai fungsi murni
 * (`tests/app/presurvei-iklan-list-query.test.ts`) — jauh lebih murah
 * daripada merendernya. Pemakaiannya sebagai kunci cache `useIklanListQuery`
 * dijaga `tests/app/presurvei-iklan-hook.test.ts`.
 */
export function buildIklanListUrl(filter: FilterIklan): string {
  const params = new URLSearchParams({
    page: String(filter.page),
    limit: String(BATAS_PER_HALAMAN),
  });

  if (filter.search.trim().length > 0) {
    params.set("search", filter.search.trim());
  }
  if (filter.channel !== "") {
    params.set("channel", filter.channel);
  }
  // Perbandingan eksplisit terhadap null, bukan truthiness: `false` adalah
  // pilihan filter yang sah ("hanya yang nonaktif").
  if (filter.isAktif !== null) {
    params.set("isAktif", String(filter.isAktif));
  }

  return `/api/admin/presurvei/iklan?${params.toString()}`;
}

/**
 * Filter setelah pemakai mengubah kriteria; selalu kembali ke halaman pertama.
 *
 * Transisi state-nya fungsi murni, bukan callback di dalam hook, karena alasan
 * yang sama dengan `buildIklanListUrl`: aturannya teruji langsung tanpa harus
 * merender hook-nya. Menyaring dari halaman lima tanpa reset ini menghasilkan
 * tabel kosong, dan pemakai menyimpulkan datanya tidak ada.
 */
export function filterSetelahUbah(
  lama: FilterIklan,
  perubahan: Partial<Omit<FilterIklan, "page">>,
): FilterIklan {
  return { ...lama, ...perubahan, page: HALAMAN_PERTAMA };
}

/** Filter setelah pemakai berpindah halaman; kriteria lain dipertahankan. */
export function filterSetelahPindahHalaman(
  lama: FilterIklan,
  page: number,
): FilterIklan {
  return { ...lama, page };
}

/**
 * Urutan pilihan status, sekaligus sumber union-nya.
 *
 * Tiga nilai, bukan dua: "semua" berarti tidak menyaring, "nonaktif" berarti
 * menyaring `isAktif=false`. Checkbox dua nilai akan menggabungkan keduanya.
 */
export const URUTAN_STATUS = ["semua", "aktif", "nonaktif"] as const;

export type KunciStatus = (typeof URUTAN_STATUS)[number];

/** Nilai filter untuk tiap pilihan status; Record memaksa ketiganya dijawab. */
export const STATUS_PILIHAN: Record<
  KunciStatus,
  { label: string; isAktif: boolean | null }
> = {
  semua: { label: "Semua status", isAktif: null },
  aktif: { label: "Hanya yang aktif", isAktif: true },
  nonaktif: { label: "Hanya yang nonaktif", isAktif: false },
};

/**
 * Kunci pilihan yang mewakili nilai filter saat ini.
 *
 * Perbandingan eksplisit terhadap null: `false` adalah pilihan yang sah, dan
 * percabangan berbasis truthiness akan menyamakan "nonaktif" dengan "semua".
 */
export function kunciStatusDari(isAktif: boolean | null): KunciStatus {
  if (isAktif === null) return "semua";
  return isAktif ? "aktif" : "nonaktif";
}
