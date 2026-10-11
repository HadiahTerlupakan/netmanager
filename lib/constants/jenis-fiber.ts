/**
 * Jenis kabel fiber yang dikenal sistem — satu daftar tertutup, dipakai
 * bersama oleh peta operasional dan peta perencanaan OSP.
 *
 * Sebelumnya daftar yang sama hidup di empat tempat: `z.enum` di
 * `app/api/map/sync`, dua `switch` di `components/map/map-utils.ts`, daftar
 * pilihan di tab Peta planning, dan `z.string()` bebas di validator jalur
 * rencana. Yang terakhir itu masalahnya: nilai `fiberType` menjadi
 * `sourceKey` item material (`kabel:<jenis>`) sekaligus namanya, jadi satu
 * salah ketik melahirkan baris BOQ baru yang permanen dan tidak pernah
 * tersapu penghapusan item otomatis (kuncinya memang "dipakai").
 *
 * Disimpan di `lib/constants` dan bukan di `modules/map`: pemakainya adalah
 * dua modul berbeda plus komponen klien, sementara barrel `modules/map`
 * menarik service berbasis Prisma sehingga tidak boleh masuk bundel klien,
 * dan impor langsung antar-modul dilarang.
 */

export const JENIS_FIBER = [
  "feeder",
  "distribution",
  "drop",
  "odp_to_odp",
  "odp_to_odp_ratio",
  "odc_to_odc",
  "odc_to_odc_ratio",
] as const;

export type JenisFiber = (typeof JENIS_FIBER)[number];

/**
 * Jenis yang ditawarkan saat menggambar jalur rencana OSP.
 *
 * Subset yang sengaja dipersempit (tanpa varian `_ratio` yang lahir dari
 * sinkronisasi peta operasional), tetapi tetap berasal dari daftar yang sama
 * supaya tidak ada nilai yang bisa dipilih di layar namun ditolak validator.
 */
export const JENIS_FIBER_JALUR_RENCANA: readonly JenisFiber[] = [
  "feeder",
  "distribution",
  "drop",
  "odc_to_odc",
  "odp_to_odp",
];

/** Label manusiawi tiap jenis; dipakai dropdown pemilihan jalur. */
export const LABEL_JENIS_FIBER: Record<JenisFiber, string> = {
  feeder: "Feeder (backbone)",
  distribution: "Distribution (ODC ke ODP)",
  drop: "Drop",
  odp_to_odp: "ODP ke ODP",
  odp_to_odp_ratio: "ODP ke ODP (rasio)",
  odc_to_odc: "ODC ke ODC",
  odc_to_odc_ratio: "ODC ke ODC (rasio)",
};

/** Warna garis per jenis fiber; jenis tak dikenal memakai abu-abu netral. */
export const WARNA_JENIS_FIBER: Record<JenisFiber, string> = {
  feeder: "#c084fc",
  odc_to_odc: "#c084fc",
  odc_to_odc_ratio: "#c084fc",
  distribution: "#60a5fa",
  odp_to_odp: "#60a5fa",
  drop: "#4ade80",
  odp_to_odp_ratio: "#4ade80",
};

/** Warna untuk nilai yang tidak ada di daftar (data lama atau kosong). */
export const WARNA_FIBER_TAK_DIKENAL = "#9ca3af";

/** Apakah sebuah nilai termasuk jenis fiber yang dikenal. */
export function isJenisFiber(nilai: unknown): nilai is JenisFiber {
  return (
    typeof nilai === "string" &&
    (JENIS_FIBER as readonly string[]).includes(nilai)
  );
}
