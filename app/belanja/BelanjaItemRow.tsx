"use client";

import { useId } from "react";

import { BELANJA_TEXTS } from "./belanja-texts";
import {
  formatStoreDate,
  type BelanjaFormLine,
  type BelanjaItem,
} from "./belanjaForm";

interface BelanjaItemRowProps {
  item: BelanjaItem;
  line: BelanjaFormLine;
  onToggle: (isChecked: boolean) => void;
  onQuantityChange: (quantity: number) => void;
  onPriceChange: (unitPrice: string) => void;
}

const INPUT_CLASS =
  "min-h-[44px] w-full rounded-xl border border-gray-400 bg-white px-3 py-2 text-base text-gray-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-indigo-900";

/** Satu barang di daftar belanja: centang, rincian toko, jumlah, harga. */
export function BelanjaItemRow({
  item,
  line,
  onToggle,
  onQuantityChange,
  onPriceChange,
}: BelanjaItemRowProps) {
  const baseId = useId();
  const checkboxId = `${baseId}-check`;
  const nameId = `${baseId}-name`;
  const summaryId = `${baseId}-summary`;
  const quantityHintId = `${baseId}-qty-hint`;
  const unit = item.unit ?? "";
  const isDone = item.remaining === 0;

  return (
    <li
      className={`rounded-2xl border p-4 ${line.isChecked ? "border-indigo-400 bg-indigo-50/60 dark:border-indigo-600 dark:bg-indigo-950/30" : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"}`}
    >
      {/* Seluruh kepala kartu bisa diketuk untuk mencentang, bukan hanya
          kotak centangnya. Nama aksesibel tetap nama barang saja. */}
      <label
        htmlFor={checkboxId}
        className={`-m-2 flex min-h-[44px] items-start gap-3 rounded-xl p-2 ${isDone ? "" : "cursor-pointer"}`}
      >
        <input
          id={checkboxId}
          type="checkbox"
          checked={line.isChecked}
          disabled={isDone}
          aria-labelledby={nameId}
          aria-describedby={summaryId}
          onChange={(event) => onToggle(event.target.checked)}
          className="mt-0.5 h-7 w-7 shrink-0 rounded border-gray-400 text-indigo-700 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
        <span className="block min-w-0 flex-1 space-y-1">
          <span
            id={nameId}
            className={`block text-base font-bold ${isDone ? "text-gray-600 line-through dark:text-gray-400" : "text-gray-900 dark:text-white"}`}
          >
            {item.name}
          </span>
          <span
            id={summaryId}
            className="block text-sm text-gray-600 dark:text-gray-400"
          >
            {isDone
              ? BELANJA_TEXTS.itemDone
              : BELANJA_TEXTS.itemSummary(
                  item.needed,
                  item.purchased,
                  item.remaining,
                  unit,
                )}
          </span>
          {item.stores.map((store, index) => (
            <span
              key={`${store.storeName}-${store.purchasedAt}-${index}`}
              className="block text-sm text-gray-600 dark:text-gray-400"
            >
              {BELANJA_TEXTS.storeBreakdown(
                store.storeName ? `di ${store.storeName}` : store.buyerName,
                formatStoreDate(store.purchasedAt),
                store.quantity,
                unit,
              )}
            </span>
          ))}
        </span>
      </label>

      {line.isChecked && !isDone && (
        <div className="mt-3 grid gap-3 pl-10 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor={`${baseId}-qty`}
              className="block text-sm font-bold text-gray-800 dark:text-gray-200"
            >
              {BELANJA_TEXTS.quantityLabel}
            </label>
            <input
              id={`${baseId}-qty`}
              type="number"
              inputMode="numeric"
              min={1}
              max={item.remaining}
              step={1}
              aria-describedby={quantityHintId}
              value={line.quantity === 0 ? "" : line.quantity}
              onChange={(event) =>
                onQuantityChange(
                  event.target.value === "" ? 0 : Number(event.target.value),
                )
              }
              className={INPUT_CLASS}
            />
            <p
              id={quantityHintId}
              className="text-xs text-gray-600 dark:text-gray-400"
            >
              {BELANJA_TEXTS.quantityHint(item.remaining)}
            </p>
          </div>
          <div className="space-y-1">
            <label
              htmlFor={`${baseId}-price`}
              className="block text-sm font-bold text-gray-800 dark:text-gray-200"
            >
              {BELANJA_TEXTS.priceLabel}
            </label>
            <input
              id={`${baseId}-price`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={BELANJA_TEXTS.priceHint}
              value={line.unitPrice}
              onChange={(event) => onPriceChange(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      )}
    </li>
  );
}
