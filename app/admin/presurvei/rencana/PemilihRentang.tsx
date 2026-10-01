"use client";

import { KELAS_TANGGAL } from "./kelasForm";
import { batasRentang, type RentangTanggal } from "./rentangTanggal";

interface PemilihRentangProps {
  rentang: RentangTanggal;
  onUbah: (perubahan: Partial<RentangTanggal>) => void;
  /** Awalan label aksesibilitas, mis. "Rencana" → "Rencana sejak tanggal". */
  labelAwalan: string;
}

/**
 * Dua medan tanggal yang saling membatasi, supaya rentang terbalik tidak
 * bisa dibentuk lewat widget-nya. Dipakai filter daftar dan rekap.
 */
export function PemilihRentang({
  rentang,
  onUbah,
  labelAwalan,
}: PemilihRentangProps) {
  const batas = batasRentang(rentang);

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={rentang.dari}
        max={batas.maksDari}
        onChange={(event) => onUbah({ dari: event.target.value })}
        aria-label={`${labelAwalan} sejak tanggal`}
        className={KELAS_TANGGAL}
      />
      <span className="text-sm text-gray-500 dark:text-gray-400">s/d</span>
      <input
        type="date"
        value={rentang.sampai}
        min={batas.minSampai}
        onChange={(event) => onUbah({ sampai: event.target.value })}
        aria-label={`${labelAwalan} sampai tanggal`}
        className={KELAS_TANGGAL}
      />
    </div>
  );
}
