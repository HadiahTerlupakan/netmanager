"use client";

import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import type { BarisRekapRencanaDto } from "@/modules/presurvei/client";

import { PemilihRentang } from "./PemilihRentang";
import {
  lebarBilahRealisasi,
  teksNama,
  teksPersenRealisasi,
} from "./tampilanRencana";
import { useRekapRencanaQuery } from "./useRekapRencanaQuery";

const PESAN_KOSONG = "Belum ada rencana pada rentang ini.";
const PESAN_GAGAL = "Rekap gagal dimuat.";

/** Kolom angka rekap, urut sesuai tampilan. */
const KOLOM_ANGKA: ReadonlyArray<{
  key: keyof BarisRekapRencanaDto;
  header: string;
  priority: "primary" | "secondary" | "tertiary";
}> = [
  { key: "total", header: "Total", priority: "primary" },
  { key: "selesai", header: "Selesai", priority: "secondary" },
  { key: "tepatWaktu", header: "Tepat waktu", priority: "tertiary" },
  { key: "terlambat", header: "Terlambat", priority: "tertiary" },
  { key: "terlewat", header: "Terlewat", priority: "secondary" },
  { key: "batal", header: "Batal", priority: "tertiary" },
  { key: "mendatang", header: "Mendatang", priority: "tertiary" },
];

/** Persen realisasi beserta bilah kemajuan kecil. */
function SelRealisasi({ persen }: { persen: number | null }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${lebarBilahRealisasi(persen)}%` }}
        />
      </div>
      <span className="w-10 text-right tabular-nums">
        {teksPersenRealisasi(persen)}
      </span>
    </div>
  );
}

/**
 * Definisi kolom rekap. Tidak diekspor: reference-nya dipakai langsung oleh
 * `<ResponsiveTable>` (alasan yang sama di `IklanTable.tsx`).
 */
const kolom: Column<BarisRekapRencanaDto>[] = [
  {
    key: "namaSales",
    header: "Sales",
    priority: "primary",
    render: (item) => teksNama(item.namaSales),
  },
  ...KOLOM_ANGKA.map(
    (angka): Column<BarisRekapRencanaDto> => ({ ...angka, align: "right" }),
  ),
  {
    key: "persenRealisasi",
    header: "% Realisasi",
    priority: "primary",
    align: "right",
    render: (item) => <SelRealisasi persen={item.persenRealisasi} />,
  },
];

/** Tab rekap: rentang tanggal dan tabel rencana vs realisasi per sales. */
export function RekapRencanaPanel() {
  const { rentang, ubahRentang, pesanRentang, baris, isLoading, isError } =
    useRekapRencanaQuery();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <PemilihRentang
          rentang={rentang}
          onUbah={ubahRentang}
          labelAwalan="Rekap"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          % realisasi = selesai ÷ (selesai + terlewat)
        </p>
      </div>

      {pesanRentang && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {pesanRentang}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <ResponsiveTable
          data={[...baris]}
          columns={kolom}
          keyField="salesId"
          loading={isLoading}
          emptyMessage={isError ? PESAN_GAGAL : PESAN_KOSONG}
        />
      </div>
    </div>
  );
}
