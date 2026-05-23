"use client";

import { FiAlertTriangle, FiCheckCircle, FiXCircle } from "react-icons/fi";

import { getStockStatusColor } from "@/lib/utils/inventory-helpers";
import { STOCK_THRESHOLD } from "@/modules/inventory/client";

import type { StockByCondition } from "./useStockByCondition";

interface StockByConditionPanelProps {
  stock: StockByCondition;
  satuan?: string;
}

/**
 * Panel ringkasan stok per kondisi (BARU/BEKAS/RUSAK + Total).
 * Dipakai oleh KeluarForm dan TransferForm di dalam SelectionSummary slot.
 */
export function StockByConditionPanel({
  stock,
  satuan,
}: StockByConditionPanelProps) {
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Stok tersedia per kondisi:
      </p>
      <div className="space-y-1">
        <ConditionRow
          icon={<FiCheckCircle className="w-3 h-3 text-green-500" />}
          label="Baru"
          value={stock.BARU}
          colorClass="text-green-600"
        />
        <ConditionRow
          icon={<FiAlertTriangle className="w-3 h-3 text-yellow-500" />}
          label="Bekas"
          value={stock.BEKAS}
          colorClass="text-yellow-600"
        />
        <ConditionRow
          icon={<FiXCircle className="w-3 h-3 text-red-500" />}
          label="Rusak"
          value={stock.RUSAK}
          colorClass="text-red-600"
        />
        <div className="pt-1 mt-1 border-t border-gray-200 dark:border-gray-600">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Total:
            </span>
            <span
              className={`text-lg font-bold ${getStockStatusColor(stock.totalStok)}`}
            >
              {stock.totalStok} {satuan || "pcs"}
            </span>
          </div>
        </div>
      </div>
      {stock.totalStok <= STOCK_THRESHOLD.OUT && (
        <p className="text-xs text-red-500 mt-2">Stok habis!</p>
      )}
      {stock.totalStok > STOCK_THRESHOLD.OUT &&
        stock.totalStok < STOCK_THRESHOLD.LOW && (
          <p className="text-xs text-yellow-500 mt-2">Stok menipis!</p>
        )}
    </div>
  );
}

function ConditionRow({
  icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
        {icon} {label}:
      </span>
      <span className={`text-sm font-medium ${colorClass}`}>{value}</span>
    </div>
  );
}
