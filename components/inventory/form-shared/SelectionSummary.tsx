"use client";

import { getStockStatusColor } from "@/lib/utils/inventory-helpers";
import { STOCK_THRESHOLD } from "@/modules/inventory/client";

import type { BarangOption } from "./useBarangOptions";
import type { GudangOption } from "./useGudangOptions";

interface SelectionSummaryProps {
  selectedBarang: BarangOption | undefined;
  selectedGudang: GudangOption | undefined;
  currentStock?: number;
  /** Custom render untuk slot stok (mis. stok per kondisi di Keluar/Transfer). */
  renderStockSlot?: () => React.ReactNode;
}

/**
 * Summary card menampilkan barang & gudang terpilih + stok saat ini.
 * Dipakai oleh MasukForm, KeluarForm, TransferForm.
 */
export function SelectionSummary({
  selectedBarang,
  selectedGudang,
  currentStock,
  renderStockSlot,
}: SelectionSummaryProps) {
  if (!selectedBarang && !selectedGudang) return null;

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {selectedBarang && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Barang terpilih:
            </p>
            <p className="font-medium text-gray-900 dark:text-white">
              {selectedBarang.kode} - {selectedBarang.nama}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Satuan: {selectedBarang.satuan}
            </p>
          </div>
        )}
        {selectedGudang && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gudang terpilih:
            </p>
            <p className="font-medium text-gray-900 dark:text-white">
              {selectedGudang.kode} - {selectedGudang.nama}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Lokasi: {selectedGudang.lokasi || "-"}
            </p>
          </div>
        )}
        {renderStockSlot
          ? renderStockSlot()
          : currentStock !== undefined && (
              <StockSlot stock={currentStock} satuan={selectedBarang?.satuan} />
            )}
      </div>
    </div>
  );
}

function StockSlot({ stock, satuan }: { stock: number; satuan?: string }) {
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">Stok saat ini:</p>
      <p className={`text-lg ${getStockStatusColor(stock)}`}>
        {stock} {satuan || "pcs"}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {stockHint(stock)}
      </p>
    </div>
  );
}

function stockHint(stock: number) {
  if (stock <= STOCK_THRESHOLD.OUT) return "Stok kosong";
  if (stock < STOCK_THRESHOLD.LOW) return "Stok menipis";
  return "Stok aman";
}
