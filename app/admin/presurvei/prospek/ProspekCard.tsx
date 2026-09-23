import {
  PROSPEK_SUMBER_CONFIG,
  type ProspekListItemDto,
} from "@/modules/presurvei/client";

import { isTakBertuan } from "./prospekKolomQuery";

/** Penanda kartu tanpa pemilik; juga dipakai test sebagai selektor teks. */
export const TEKS_TAK_BERTUAN = "Belum ada pemilik";

interface ProspekCardProps {
  prospek: ProspekListItemDto;
}

/**
 * Satu kartu prospek di papan.
 *
 * Pemilik ditampilkan sebagai `pemilikId` apa adanya: DTO presurvei belum
 * membawa nama sales, dan sumber namanya dijadwalkan sebagai Task 20.
 *
 * Kartu tanpa pemilik diberi penanda mencolok. Prospek tak bertuan lahir saat
 * form publik masuk dan tenant belum punya sales aktif; tanpa penanda tidak
 * ada yang membedakannya dari kartu lain, padahal tidak ada sales yang
 * bertanggung jawab menghubunginya.
 */
export function ProspekCard({ prospek }: ProspekCardProps) {
  const sumber = PROSPEK_SUMBER_CONFIG[prospek.sumber];
  const isTanpaPemilik = isTakBertuan(prospek);

  return (
    <article
      data-prospek-id={prospek.id}
      className={`rounded-lg border bg-white p-3 dark:bg-gray-800 ${
        isTanpaPemilik
          ? "border-amber-400 dark:border-amber-500"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <p className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-white">
        {prospek.nama}
      </p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {prospek.noTelp}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className={`rounded-full px-2 py-0.5 ${sumber.warna}`}>
          {sumber.label}
        </span>
        {isTanpaPemilik ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
            {TEKS_TAK_BERTUAN}
          </span>
        ) : (
          <span
            className="truncate text-gray-500 dark:text-gray-400"
            title="Pemilik"
          >
            {prospek.pemilikId}
          </span>
        )}
      </div>
    </article>
  );
}
