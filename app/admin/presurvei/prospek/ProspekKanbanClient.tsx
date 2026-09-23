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
import {
  keadaanKolom,
  teksJumlahKolom,
  type KeadaanKolom,
} from "./prospekKolomQuery";
import { useProspekKolom } from "./useProspekKolom";

/** Jumlah kerangka kartu yang mengisi kolom selama halaman pertamanya dimuat. */
const JUMLAH_KERANGKA_KARTU = 3;

/** Label sakelar kolom mati; juga dipakai test sebagai selektor. */
export const LABEL_SAKELAR_KOLOM_MATI = "Tampilkan prospek yang gugur";

/** Pesan badan kolom yang halaman pertamanya gagal dimuat. */
export const TEKS_KOLOM_GAGAL = "Kolom ini gagal dimuat";

/** Pesan badan kolom yang memang tidak punya prospek. */
export const TEKS_KOLOM_KOSONG = "Belum ada prospek di tahap ini";

/** Pesan kecil saat kartu sudah ada tetapi halaman berikutnya gagal. */
const TEKS_SEBAGIAN_GAGAL = "Sebagian kartu gagal dimuat";

type ProspekKolomData = ReturnType<typeof useProspekKolom>;

/** Badan kolom sesuai keadaannya; kartu hanya dirender saat `berisi`. */
function BadanKolom({
  keadaan,
  kartu,
}: {
  keadaan: KeadaanKolom;
  kartu: ProspekKolomData["kartu"];
}) {
  switch (keadaan) {
    case "memuat":
      return (
        <>
          {Array.from({ length: JUMLAH_KERANGKA_KARTU }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </>
      );
    case "gagal":
      return (
        <p role="alert" className="px-3 py-8 text-center text-xs text-red-600">
          {TEKS_KOLOM_GAGAL}
        </p>
      );
    case "kosong":
      return (
        <p className="px-3 py-8 text-center text-xs text-gray-400">
          {TEKS_KOLOM_KOSONG}
        </p>
      );
    case "berisi":
      return (
        <>
          {kartu.map((prospek) => (
            <ProspekCard key={prospek.id} prospek={prospek} />
          ))}
        </>
      );
  }
}

/**
 * Tombol kaki kolom: satu jalan untuk memuat lebih maupun mencoba lagi.
 *
 * Bila ada halaman yang gagal, `muatLebih` mengambil ulang halaman itu alih-
 * alih maju (`useProspekKolom`), jadi labelnya ikut berganti.
 */
function TombolKakiKolom({ kolom }: { kolom: ProspekKolomData }) {
  const isAdaGagal = kolom.halamanGagal !== null;
  if (kolom.isLoading || (!isAdaGagal && !kolom.adaLagi)) return null;

  return (
    <>
      {isAdaGagal && kolom.kartu.length > 0 && (
        <p role="alert" className="text-center text-xs text-red-600">
          {TEKS_SEBAGIAN_GAGAL}
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        loading={kolom.isMemuatLebih}
        disabled={kolom.isMemuatLebih}
        onClick={kolom.muatLebih}
      >
        {isAdaGagal ? "Coba lagi" : "Muat lebih"}
      </Button>
    </>
  );
}

/** Satu kolom papan: mengambil datanya sendiri dan memuat lebih sendiri. */
function ProspekKolom({ status }: { status: ProspekStatus }) {
  const kolom = useProspekKolom(status);
  const tampilan = PROSPEK_STATUS_CONFIG[status];
  const keadaan = keadaanKolom({
    isLoading: kolom.isLoading,
    halamanGagal: kolom.halamanGagal,
    jumlahKartu: kolom.kartu.length,
  });
  // Tanpa meta, "0 dari 0" di kolom yang gagal akan berbohong.
  const isJumlahDiketahui = keadaan === "kosong" || keadaan === "berisi";

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
        {isJumlahDiketahui && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {teksJumlahKolom(kolom.kartu.length, kolom.total)}
          </span>
        )}
      </header>

      <div className="min-h-32 flex-1 space-y-2 overflow-y-auto p-2">
        <BadanKolom keadaan={keadaan} kartu={kolom.kartu} />
        <TombolKakiKolom kolom={kolom} />
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
