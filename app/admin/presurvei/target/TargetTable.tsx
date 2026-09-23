"use client";

import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";

import { pesanTabelKosong, type BarisTarget } from "./barisTarget";

interface TargetTableProps {
  baris: BarisTarget[];
  isLoading: boolean;
  /** GET target gagal; tabel kosong lalu tidak disebut "belum ada target". */
  isError: boolean;
  /** Null bila pemakai tidak berhak mengubah; kolom aksi lalu tidak tampil. */
  onUbah: ((baris: BarisTarget) => void) | null;
}

/**
 * Definisi kolom tabel target. Tidak diekspor karena reference-nya dipakai
 * langsung oleh `<ResponsiveTable>` (lihat catatan di `IklanTable.tsx`).
 * Label sales sudah dibentuk `keBarisTarget`, jadi tidak ada `render` di sini.
 */
const kolom: Column<BarisTarget>[] = [
  { key: "namaSales", header: "Sales", priority: "primary" },
  {
    key: "targetKunjungan",
    header: "Kunjungan",
    priority: "primary",
    align: "right",
  },
  {
    key: "targetProspek",
    header: "Prospek",
    priority: "secondary",
    align: "right",
  },
  {
    key: "targetKonversi",
    header: "Konversi",
    priority: "secondary",
    align: "right",
  },
];

/** Tabel target seluruh sales pada satu periode. */
export function TargetTable({
  baris,
  isLoading,
  isError,
  onUbah,
}: TargetTableProps) {
  return (
    <ResponsiveTable
      data={baris}
      columns={kolom}
      keyField="id"
      loading={isLoading}
      emptyMessage={pesanTabelKosong(isError)}
      renderActions={
        onUbah
          ? (item) => (
              <button
                type="button"
                onClick={() => onUbah(item)}
                className="text-sm text-indigo-600 hover:underline"
              >
                Ubah
              </button>
            )
          : undefined
      }
    />
  );
}
