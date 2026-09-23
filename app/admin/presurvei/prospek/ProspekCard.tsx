import {
  PROSPEK_SUMBER_CONFIG,
  type ProspekListItemDto,
} from "@/modules/presurvei/client";

import { isTakBertuan } from "./prospekKolomQuery";

/** Penanda kartu tanpa pemilik; juga dipakai test sebagai selektor teks. */
export const TEKS_TAK_BERTUAN = "Belum ada pemilik";

/** Label tombol pembuka form ubah; juga dipakai test sebagai selektor. */
export const LABEL_TOMBOL_UBAH = "Ubah";

interface ProspekCardProps {
  prospek: ProspekListItemDto;
  /** Kartu hanya bisa diseret bila pemakai boleh mengubah prospek. */
  isDapatDiseret?: boolean;
  /** Kartu menunggu jawaban server setelah dijatuhkan. */
  isSedangDipindah?: boolean;
  onMulaiSeret?: () => void;
  onSelesaiSeret?: () => void;
  /** Membuka form ubah; tombolnya hanya tampil bila diisi. */
  onUbah?: () => void;
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
export function ProspekCard({
  prospek,
  isDapatDiseret = false,
  isSedangDipindah = false,
  onMulaiSeret,
  onSelesaiSeret,
  onUbah,
}: ProspekCardProps) {
  const sumber = PROSPEK_SUMBER_CONFIG[prospek.sumber];
  const isTanpaPemilik = isTakBertuan(prospek);
  // Satu syarat untuk atribut dan kursornya: kartu yang sedang dipindah tidak
  // bisa diangkat, jadi juga tidak boleh menampilkan kursor genggam.
  const isBisaDiangkat = isDapatDiseret && !isSedangDipindah;

  return (
    <article
      data-prospek-id={prospek.id}
      draggable={isBisaDiangkat}
      aria-busy={isSedangDipindah}
      onDragStart={(event) => {
        // Sama dengan preseden `app/admin/planning/PlanningKanbanClient.tsx:77-78`.
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", prospek.id);
        onMulaiSeret?.();
      }}
      onDragEnd={onSelesaiSeret}
      className={`rounded-lg border bg-white p-3 dark:bg-gray-800 ${
        isTanpaPemilik
          ? "border-amber-400 dark:border-amber-500"
          : "border-gray-200 dark:border-gray-700"
      } ${isBisaDiangkat ? "cursor-grab active:cursor-grabbing" : ""} ${
        isSedangDipindah ? "opacity-40" : ""
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
        {onUbah && (
          <button
            type="button"
            onClick={onUbah}
            className="ml-auto rounded px-1.5 py-0.5 font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
          >
            {LABEL_TOMBOL_UBAH}
          </button>
        )}
      </div>
    </article>
  );
}
