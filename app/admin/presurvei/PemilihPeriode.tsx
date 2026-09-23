"use client";

import { useMemo } from "react";

import {
  namaBulan,
  periodeSekarang,
  pilihanBulan,
  pilihanTahun,
  type Periode,
} from "./periode";

const KELAS_SELECT =
  "cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

interface PemilihPeriodeProps {
  periode: Periode;
  onUbah: (perubahan: Partial<Periode>) => void;
}

/** Pemilih bulan + tahun bersama layar target dan laporan presurvei. */
export function PemilihPeriode({ periode, onUbah }: PemilihPeriodeProps) {
  const tahunTersedia = useMemo(
    () => pilihanTahun(periodeSekarang().tahun),
    [],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        aria-label="Bulan periode"
        value={periode.bulan}
        onChange={(event) => onUbah({ bulan: Number(event.target.value) })}
        className={KELAS_SELECT}
      >
        {pilihanBulan().map((bulan) => (
          <option key={bulan} value={bulan}>
            {namaBulan(bulan)}
          </option>
        ))}
      </select>

      <select
        aria-label="Tahun periode"
        value={periode.tahun}
        onChange={(event) => onUbah({ tahun: Number(event.target.value) })}
        className={KELAS_SELECT}
      >
        {tahunTersedia.map((tahun) => (
          <option key={tahun} value={tahun}>
            {tahun}
          </option>
        ))}
      </select>
    </div>
  );
}
