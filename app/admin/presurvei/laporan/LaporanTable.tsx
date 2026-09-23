"use client";

import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";

import {
  pesanLaporanKosong,
  type BarisTampilan,
  type MetrikTampilan,
} from "./barisLaporan";

interface LaporanTableProps {
  baris: BarisTampilan[];
  isLoading: boolean;
  /** GET laporan gagal; tabel kosong lalu tidak disebut "belum ada target". */
  isError: boolean;
}

/** Sel satu metrik: angka sebenarnya dan bilah kemajuan, atau "tanpa target". */
function SelMetrik({ metrik }: { metrik: MetrikTampilan }) {
  if (metrik.isTargetNol) {
    return (
      <div className="text-sm">
        <span className="font-medium">{metrik.tercapai}</span>
        <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
          (tanpa target)
        </span>
      </div>
    );
  }

  return (
    <div className="min-w-[8rem] space-y-1">
      <div className="text-sm">
        <span className="font-medium">{metrik.tercapai}</span>
        <span className="text-gray-500 dark:text-gray-400">
          {" "}
          / {metrik.target} · {metrik.persen}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
        <div
          className="h-1.5 rounded-full bg-indigo-500"
          style={{ width: `${metrik.lebarBilah}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Definisi kolom laporan. Tidak diekspor karena reference-nya dipakai
 * langsung oleh `<ResponsiveTable>` (lihat catatan di `IklanTable.tsx`).
 */
const kolom: Column<BarisTampilan>[] = [
  {
    key: "namaSales",
    header: "Sales",
    priority: "primary",
    render: (item) => (
      <div>
        <div>{item.namaSales}</div>
        {item.isTanpaTarget && (
          <div className="text-xs text-amber-600 dark:text-amber-400">
            Target belum ditetapkan
          </div>
        )}
      </div>
    ),
  },
  {
    key: "kunjungan",
    header: "Kunjungan",
    priority: "primary",
    render: (item) => <SelMetrik metrik={item.kunjungan} />,
  },
  {
    key: "prospek",
    header: "Prospek baru",
    priority: "secondary",
    render: (item) => <SelMetrik metrik={item.prospek} />,
  },
  {
    key: "konversi",
    header: "Konversi",
    priority: "secondary",
    render: (item) => <SelMetrik metrik={item.konversi} />,
  },
];

/** Tabel pencapaian seluruh sales bertarget pada satu periode. */
export function LaporanTable({ baris, isLoading, isError }: LaporanTableProps) {
  return (
    <ResponsiveTable
      data={baris}
      columns={kolom}
      keyField="userId"
      loading={isLoading}
      emptyMessage={pesanLaporanKosong(isError)}
    />
  );
}
