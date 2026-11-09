"use client";

import { useId } from "react";

import type { PurchaseFormLine } from "./restockPurchaseForm";

interface RestockPurchaseLineRowProps {
  line: PurchaseFormLine;
  onToggle: (isChecked: boolean) => void;
  onQuantityChange: (quantity: number) => void;
  onPriceChange: (unitPrice: string) => void;
}

const INPUT_CLASS =
  "min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-indigo-900 dark:disabled:bg-gray-800 dark:disabled:text-gray-400";

function describeRemaining(line: PurchaseFormLine): string {
  if (line.remainingToBuy === 0) return "Sudah dibeli semua";
  const satuan = line.satuan ? ` ${line.satuan}` : "";
  return `Belum dibeli ${line.remainingToBuy}${satuan}`;
}

/** Satu barang di modal "Catat Belanja": centang, jumlah dibeli, harga. */
export function RestockPurchaseLineRow({
  line,
  onToggle,
  onQuantityChange,
  onPriceChange,
}: RestockPurchaseLineRowProps) {
  const baseId = useId();
  const checkboxId = `${baseId}-check`;
  const hintId = `${baseId}-hint`;
  const isSoldOut = line.remainingToBuy === 0;
  const isEditable = line.isChecked && !isSoldOut;

  return (
    <li className="space-y-3 rounded-2xl border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          checked={line.isChecked}
          disabled={isSoldOut}
          aria-describedby={hintId}
          onChange={(event) => onToggle(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 rounded border-gray-400 text-indigo-700 focus:ring-indigo-500 disabled:opacity-50"
        />
        <div className="min-w-0">
          <label
            htmlFor={checkboxId}
            className={`text-sm font-bold ${isSoldOut ? "text-gray-600 dark:text-gray-400" : "text-gray-900 dark:text-white"}`}
          >
            {line.nama}
          </label>
          <p id={hintId} className="text-xs text-gray-600 dark:text-gray-400">
            {describeRemaining(line)}
          </p>
        </div>
      </div>
      {!isSoldOut && (
        <div className="grid gap-3 pl-8 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-bold text-gray-700 dark:text-gray-300">
            <span>Jumlah dibeli{line.satuan ? ` (${line.satuan})` : ""}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={line.remainingToBuy}
              step={1}
              disabled={!isEditable}
              value={line.quantity === 0 ? "" : line.quantity}
              onChange={(event) =>
                onQuantityChange(
                  event.target.value === "" ? 0 : Number(event.target.value),
                )
              }
              className={INPUT_CLASS}
            />
          </label>
          <label className="space-y-1 text-xs font-bold text-gray-700 dark:text-gray-300">
            <span>Harga satuan (tidak wajib)</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Contoh: 12.000"
              disabled={!isEditable}
              value={line.unitPrice}
              onChange={(event) => onPriceChange(event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        </div>
      )}
    </li>
  );
}
