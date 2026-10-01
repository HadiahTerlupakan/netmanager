import type { PenilaianKepala } from "@/modules/presurvei/client";

import { DaftarBilahIndikator, SkorPredikat } from "./BilahIndikator";
import { daftarIndikator, indikatorTerlemah, LABEL_INDIKATOR_KEPALA } from "./tampilanPenilaian";

interface KartuKepalaProps {
  kepala: PenilaianKepala;
  isTerpilih: boolean;
  onPilih: () => void;
}

/** Kartu penilaian seorang kepala sales; klik untuk menampilkan timnya. */
export function KartuKepala({ kepala, isTerpilih, onPilih }: KartuKepalaProps) {
  const indikator = daftarIndikator(kepala.indikator, LABEL_INDIKATOR_KEPALA);
  const terlemah = indikatorTerlemah(indikator);

  return (
    <button
      type="button"
      onClick={onPilih}
      aria-pressed={isTerpilih}
      className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition dark:bg-gray-800 ${
        isTerpilih
          ? "border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900"
          : "border-gray-100 hover:border-indigo-300 dark:border-gray-700"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">{kepala.nama}</div>
          <div className="text-xs text-gray-500">Kepala sales · {kepala.jumlahAnggota} anggota</div>
        </div>
        <SkorPredikat skor={kepala.skor} predikat={kepala.predikat} />
      </div>
      <div className="mt-4">
        <DaftarBilahIndikator daftar={indikator} />
      </div>
      {terlemah !== null && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
          Perlu perhatian: {terlemah.label.toLowerCase()} ({terlemah.nilai})
        </p>
      )}
    </button>
  );
}
