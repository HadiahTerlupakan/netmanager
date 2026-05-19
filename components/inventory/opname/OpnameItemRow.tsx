"use client";

import { FiAlertTriangle } from "react-icons/fi";
import type { OpnameCalculationItem } from "./useOpnameCalculation";

const HIGH_QUALITY_THRESHOLD_PERCENT = 95;
const MEDIUM_QUALITY_THRESHOLD_PERCENT = 85;

const ALASAN_SELISIH_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  [
    { value: "", label: "-- Pilih Alasan --" },
    { value: "hilang", label: "Hilang / Kehilangan" },
    { value: "rusak", label: "Rusak / Tidak Layak" },
    { value: "revisi", label: "Revisi Stok / Koreksi Data" },
    { value: "salah_input", label: "Kesalahan Input Sebelumnya" },
    { value: "terpakai", label: "Terpakai Tidak Tercatat" },
    { value: "expired", label: "Kadaluarsa / Expire" },
    { value: "lebih", label: "Stok Lebih / Ditemukan" },
    { value: "lainnya", label: "Lainnya" },
  ];

interface OpnameItemRowProps {
  item: OpnameCalculationItem;
  isSubmitting: boolean;
  onChange: (barangId: string, patch: Partial<OpnameCalculationItem>) => void;
}

export function OpnameItemRow({
  item,
  isSubmitting,
  onChange,
}: OpnameItemRowProps) {
  const hasDiscrepancy = item.stokFisik !== item.stokSistem;
  const conditionBadge = getConditionBadge(
    item.kondisiBaik,
    item.kondisiRusak,
    item.kondisiExpire,
  );

  return (
    <tr
      className={`${hasDiscrepancy ? "bg-yellow-50 dark:bg-yellow-900/10" : ""}`}
    >
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {item.barangKode}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {item.barangNama}
        </div>
      </td>

      <SystemStockCell stokSistem={item.stokSistem} />

      <ConditionInputCell
        value={item.kondisiBaik}
        accent="green"
        disabled={isSubmitting}
        onChange={(newValue) =>
          onChange(item.barangId, {
            kondisiBaik: newValue,
            stokFisik: newValue + item.kondisiRusak + item.kondisiExpire,
          })
        }
      />
      <ConditionInputCell
        value={item.kondisiRusak}
        accent="yellow"
        disabled={isSubmitting}
        onChange={(newValue) =>
          onChange(item.barangId, {
            kondisiRusak: newValue,
            stokFisik: item.kondisiBaik + newValue + item.kondisiExpire,
          })
        }
      />
      <ConditionInputCell
        value={item.kondisiExpire}
        accent="orange"
        disabled={isSubmitting}
        onChange={(newValue) =>
          onChange(item.barangId, {
            kondisiExpire: newValue,
            stokFisik: item.kondisiBaik + item.kondisiRusak + newValue,
          })
        }
      />

      <td className="px-2 py-3 text-center">
        <div className="flex flex-col items-center">
          <span
            className={`font-bold text-sm ${
              hasDiscrepancy ? "text-orange-600" : "text-blue-600"
            }`}
          >
            {item.stokFisik}
          </span>
          {hasDiscrepancy && (
            <span className="text-xs text-orange-600 font-medium">
              Selisih: {item.stokFisik - item.stokSistem}
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col space-y-1">
          {conditionBadge && (
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${conditionBadge.color}`}
            >
              {conditionBadge.text}
            </span>
          )}
          {hasDiscrepancy && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400">
              <FiAlertTriangle className="mr-1 h-3 w-3" />
              Ada Selisih
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        {hasDiscrepancy ? (
          <select
            value={item.alasanSelisih || ""}
            onChange={(e) =>
              onChange(item.barangId, { alasanSelisih: e.target.value })
            }
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={isSubmitting}
          >
            {ALASAN_SELISIH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="text-sm text-gray-900 dark:text-white">
          <div>{item.lokasiPenyimpanan || "-"}</div>
          {item.nomorRak && (
            <div className="text-xs text-gray-500">Rak {item.nomorRak}</div>
          )}
        </div>
      </td>
    </tr>
  );
}

function SystemStockCell({ stokSistem }: { stokSistem: number }) {
  return (
    <td className="px-2 py-3 text-center">
      <div className="flex flex-col items-center">
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            stokSistem === 0
              ? "bg-red-100 text-red-800"
              : stokSistem < 5
                ? "bg-yellow-100 text-yellow-800"
                : "bg-green-100 text-green-800"
          }`}
        >
          {stokSistem}
        </span>
        <span className="text-xs text-gray-500 mt-1">Sistem</span>
      </div>
    </td>
  );
}

interface ConditionInputCellProps {
  value: number;
  accent: "green" | "yellow" | "orange";
  disabled: boolean;
  onChange: (value: number) => void;
}

function ConditionInputCell({
  value,
  accent,
  disabled,
  onChange,
}: ConditionInputCellProps) {
  const accentClass = ACCENT_CLASSES[accent];
  return (
    <td className="px-2 py-3 text-center">
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => {
          const newValue = parseInt(e.target.value, 10);
          onChange(Number.isFinite(newValue) ? Math.max(0, newValue) : 0);
        }}
        className={`w-16 px-1 py-1 text-center border rounded text-sm font-medium ${accentClass}`}
        disabled={disabled}
      />
    </td>
  );
}

const ACCENT_CLASSES: Record<ConditionInputCellProps["accent"], string> = {
  green:
    "border-green-300 focus:ring-green-500 focus:border-green-500 text-green-600",
  yellow:
    "border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500 text-yellow-600",
  orange:
    "border-orange-300 focus:ring-orange-500 focus:border-orange-500 text-orange-600",
};

function getConditionBadge(baik: number, rusak: number, bekas: number) {
  const total = baik + rusak + bekas;
  if (total === 0) return null;
  const percent = (baik / total) * 100;

  if (percent >= HIGH_QUALITY_THRESHOLD_PERCENT) {
    return { color: "bg-green-100 text-green-800", text: "Sangat Baik" };
  }
  if (percent >= MEDIUM_QUALITY_THRESHOLD_PERCENT) {
    return { color: "bg-yellow-100 text-yellow-800", text: "Baik" };
  }
  return { color: "bg-red-100 text-red-800", text: "Perlu Perhatian" };
}
