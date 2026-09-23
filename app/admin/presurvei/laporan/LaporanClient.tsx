"use client";

import { useMemo } from "react";

import { PemilihPeriode } from "../PemilihPeriode";
import { useDaftarSalesPresurvei } from "../useDaftarSalesPresurvei";
import { keBarisTampilan } from "./barisLaporan";
import { LaporanTable } from "./LaporanTable";
import { useLaporanPeriode } from "./useLaporanPeriode";

/** Layar laporan pencapaian target sales per periode. */
export function LaporanClient() {
  const { periode, ubahPeriode, daftarLaporan, isLoading, isError } =
    useLaporanPeriode();
  const daftarSales = useDaftarSalesPresurvei();

  const baris = useMemo(
    () => keBarisTampilan(daftarLaporan, daftarSales),
    [daftarLaporan, daftarSales],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Laporan Pencapaian
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Kunjungan, prospek baru, dan konversi setiap sales terhadap targetnya
        </p>
      </div>

      <PemilihPeriode periode={periode} onUbah={ubahPeriode} />

      <div>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <LaporanTable baris={baris} isLoading={isLoading} isError={isError} />
        </div>

        {/* Dua batasan Fase 2 yang wajib terlihat: laporan disusun dari daftar
            target (`TargetService.ts:53-54,64`), dan rentang UTC yang sama
            (`TargetService.ts:56-61`) menyaring ketiga metrik —
            `KegiatanRepository.ts:100`, `ProspekRepository.ts:139,148`. */}
        <p className="mt-4 text-sm text-gray-500">
          Sales yang belum ditetapkan targetnya pada periode ini tidak muncul di
          daftar, karena laporan disusun dari daftar target.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Batas periode memakai waktu UTC, bukan zona waktu setempat. Kunjungan,
          prospek baru, dan konversi pada jam-jam pertama tanggal 1 dapat
          terhitung pada bulan sebelumnya.
        </p>
      </div>
    </div>
  );
}
