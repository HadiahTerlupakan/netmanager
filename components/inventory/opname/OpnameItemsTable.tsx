"use client";

import { OpnameItemRow } from "./OpnameItemRow";
import type { OpnameCalculationItem } from "./useOpnameCalculation";

interface OpnameItemsTableProps {
  /** Barang yang ditampilkan (sudah tersaring). */
  items: OpnameCalculationItem[];
  totalItems: number;
  dihitungIds: ReadonlySet<string>;
  dihitungCount: number;
  soBulanIniCount: number;
  isHanyaBelumSo: boolean;
  onHanyaBelumSoChange: (value: boolean) => void;
  onToggleDihitung: (barangIds: string[], isDihitung: boolean) => void;
  itemsWithDiscrepancyCount: number;
  gudangNama: string | undefined;
  isSubmitting: boolean;
  onItemChange: (
    barangId: string,
    patch: Partial<OpnameCalculationItem>,
  ) => void;
}

export function OpnameItemsTable({
  items,
  totalItems,
  dihitungIds,
  dihitungCount,
  soBulanIniCount,
  isHanyaBelumSo,
  onHanyaBelumSoChange,
  onToggleDihitung,
  itemsWithDiscrepancyCount,
  gudangNama,
  isSubmitting,
  onItemChange,
}: OpnameItemsTableProps) {
  const visibleIds = items.map((item) => item.barangId);
  const isSemuaDihitung =
    visibleIds.length > 0 && visibleIds.every((id) => dihitungIds.has(id));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Input Stock Opname - Hitung Stok Fisik
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bandingkan stok sistem dengan hasil hitungan fisik di {gudangNama}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={isHanyaBelumSo}
            onChange={(e) => onHanyaBelumSoChange(e.target.checked)}
            className="rounded border-gray-300"
          />
          Hanya yang belum di-SO bulan ini
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-3 py-3 text-center">
                <input
                  type="checkbox"
                  aria-label="Tandai semua barang yang tampil sudah dihitung"
                  title="Tandai semua yang tampil sudah dihitung"
                  checked={isSemuaDihitung}
                  disabled={isSubmitting || visibleIds.length === 0}
                  onChange={(e) => onToggleDihitung(visibleIds, e.target.checked)}
                  className="rounded border-gray-300"
                />
              </th>
              <Th align="left">Barang</Th>
              <Th align="center">Stok Sistem</Th>
              <Th align="center">Baik</Th>
              <Th align="center">Rusak</Th>
              <Th align="center">Bekas/Expire</Th>
              <Th align="center">Total</Th>
              <Th align="left">Status</Th>
              <Th align="left">Alasan Selisih</Th>
              <Th align="left">Lokasi</Th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((item) => (
              <OpnameItemRow
                key={item.barangId}
                item={item}
                isDihitung={dihitungIds.has(item.barangId)}
                onToggleDihitung={(isDihitung) =>
                  onToggleDihitung([item.barangId], isDihitung)
                }
                isSubmitting={isSubmitting}
                onChange={onItemChange}
              />
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="px-6 py-6 text-sm text-center text-green-600">
            Semua barang sudah di-SO bulan ini.
          </p>
        )}
      </div>

      <TableFooter
        totalItems={totalItems}
        dihitungCount={dihitungCount}
        soBulanIniCount={soBulanIniCount}
        discrepancyCount={itemsWithDiscrepancyCount}
      />
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "left" | "center";
}) {
  const alignClass = align === "center" ? "text-center px-2" : "text-left px-4";
  return (
    <th
      className={`${alignClass} py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider`}
    >
      {children}
    </th>
  );
}

function TableFooter({
  totalItems,
  dihitungCount,
  soBulanIniCount,
  discrepancyCount,
}: {
  totalItems: number;
  dihitungCount: number;
  soBulanIniCount: number;
  discrepancyCount: number;
}) {
  return (
    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="text-gray-500 dark:text-gray-400">
          Sudah di-SO bulan ini: {soBulanIniCount} dari {totalItems} barang | Ada
          selisih: {discrepancyCount}
        </div>
        <span
          className={`font-medium ${dihitungCount > 0 ? "text-indigo-600" : "text-gray-500"}`}
        >
          Dicentang untuk disimpan: {dihitungCount} barang
        </span>
      </div>
    </div>
  );
}
