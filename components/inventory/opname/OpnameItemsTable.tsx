"use client";

import { OpnameItemRow } from "./OpnameItemRow";
import type { OpnameCalculationItem } from "./useOpnameCalculation";

interface OpnameItemsTableProps {
  items: OpnameCalculationItem[];
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
  itemsWithDiscrepancyCount,
  gudangNama,
  isSubmitting,
  onItemChange,
}: OpnameItemsTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Input Stock Opname - Hitung Stok Fisik
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Bandingkan stok sistem dengan hasil hitungan fisik di {gudangNama}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
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
                isSubmitting={isSubmitting}
                onChange={onItemChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      <TableFooter
        totalItems={items.length}
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
  discrepancyCount,
}: {
  totalItems: number;
  discrepancyCount: number;
}) {
  return (
    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Total barang: {totalItems} | Item dengan perbedaan: {discrepancyCount}
        </div>
        <div className="text-sm">
          <span
            className={`font-medium ${discrepancyCount > 0 ? "text-indigo-600" : "text-green-600"}`}
          >
            {discrepancyCount > 0
              ? `${discrepancyCount} item perlu dicatat`
              : "Tidak ada perbedaan"}
          </span>
        </div>
      </div>
    </div>
  );
}
