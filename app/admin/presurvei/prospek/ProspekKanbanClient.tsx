"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/LoadingSkeleton";
import {
  daftarKolomHidup,
  daftarKolomMati,
  PROSPEK_STATUS_CONFIG,
  type ProspekStatus,
} from "@/modules/presurvei/client";

import { ProspekCard } from "./ProspekCard";
import { teksJumlahKolom } from "./prospekKolomQuery";
import { useProspekKolom } from "./useProspekKolom";

/** Jumlah kerangka kartu yang mengisi kolom selama halaman pertamanya dimuat. */
const JUMLAH_KERANGKA_KARTU = 3;

/** Label sakelar kolom mati; juga dipakai test sebagai selektor. */
export const LABEL_SAKELAR_KOLOM_MATI = "Tampilkan prospek yang gugur";

/** Satu kolom papan: mengambil datanya sendiri dan memuat lebih sendiri. */
function ProspekKolom({ status }: { status: ProspekStatus }) {
  const { kartu, total, adaLagi, isLoading, isMemuatLebih, muatLebih } =
    useProspekKolom(status);
  const tampilan = PROSPEK_STATUS_CONFIG[status];

  return (
    <section
      aria-label={tampilan.label}
      data-status={status}
      className="flex max-h-[calc(100vh-240px)] w-72 flex-shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
    >
      <header className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2.5 dark:border-gray-700">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tampilan.warna}`}
        >
          {tampilan.label}
        </span>
        {!isLoading && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {teksJumlahKolom(kartu.length, total)}
          </span>
        )}
      </header>

      <div className="min-h-32 flex-1 space-y-2 overflow-y-auto p-2">
        {isLoading ? (
          Array.from({ length: JUMLAH_KERANGKA_KARTU }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))
        ) : kartu.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-gray-400">
            Belum ada prospek di tahap ini
          </p>
        ) : (
          kartu.map((prospek) => (
            <ProspekCard key={prospek.id} prospek={prospek} />
          ))
        )}

        {adaLagi && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            loading={isMemuatLebih}
            disabled={isMemuatLebih}
            onClick={muatLebih}
          >
            Muat lebih
          </Button>
        )}
      </div>
    </section>
  );
}

/**
 * Papan prospek: satu kolom per status corong.
 *
 * Kolom mati (`TIDAK_MINAT`, `TIDAK_LAYAK`) disembunyikan di balik sakelar:
 * keduanya tumbuh tanpa batas dan menenggelamkan corong kerja. Kolom yang
 * tidak dirender tidak memasang hook-nya, jadi sakelar yang mati juga berarti
 * dua permintaan lebih sedikit.
 *
 * Tidak ada skeleton yang menggantikan seluruh papan. Kerangka dirender di
 * dalam tiap kolom, supaya kontrol di atas papan tetap terpasang selama kolom
 * memuat — akibat sebaliknya tercatat di
 * `app/admin/planning/PlanningKanbanClient.tsx:45-52`.
 */
export function ProspekKanbanClient() {
  const [isKolomMatiTampil, setIsKolomMatiTampil] = useState(false);

  const kolom = isKolomMatiTampil
    ? [...daftarKolomHidup(), ...daftarKolomMati()]
    : daftarKolomHidup();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Papan Prospek
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Calon pelanggan yang sedang digarap tim sales, per tahap corong
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={isKolomMatiTampil}
            onChange={(event) => setIsKolomMatiTampil(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          {LABEL_SAKELAR_KOLOM_MATI}
        </label>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {kolom.map((status) => (
          <ProspekKolom key={status} status={status} />
        ))}
      </div>
    </div>
  );
}
