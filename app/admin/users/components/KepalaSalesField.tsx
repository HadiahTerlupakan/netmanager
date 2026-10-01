"use client";

import { opsiKepalaSales, type KepalaSalesTersimpan } from "../lib/kepalaSales";
import { useKandidatKepalaSales } from "../lib/useKandidatKepalaSales";

interface KepalaSalesFieldProps {
  value: string;
  handleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  /** Id user yang sedang diubah; null pada form tambah user. */
  userIdDiubah: string | null;
  /** Kepala sales yang tersimpan pada user yang diubah. */
  tersimpan: KepalaSalesTersimpan | null;
}

/** Pemilih kepala sales untuk user sales (tim penugasan rencana kunjungan). */
export function KepalaSalesField({
  value,
  handleChange,
  userIdDiubah,
  tersimpan,
}: KepalaSalesFieldProps) {
  const { kandidat, isLoading, isError } = useKandidatKepalaSales();
  const opsi = opsiKepalaSales(kandidat, userIdDiubah, tersimpan);

  return (
    <div className="md:col-span-2">
      <label
        htmlFor="kepalaSalesId"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        Kepala Sales
      </label>
      <select
        id="kepalaSalesId"
        name="kepalaSalesId"
        value={value}
        onChange={handleChange}
        disabled={isLoading}
        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
      >
        <option value="">
          {isLoading ? "Memuat daftar kepala sales…" : "— Tanpa kepala sales —"}
        </option>
        {opsi.map((calon) => (
          <option key={calon.id} value={calon.id}>
            {calon.nama}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Kepala sales dapat menugaskan rencana kunjungan ke user ini.
      </p>
      {isError && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          Daftar kepala sales gagal dimuat.
        </p>
      )}
    </div>
  );
}
