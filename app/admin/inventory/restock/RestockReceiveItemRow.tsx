"use client";

import { useId, useMemo, useState } from "react";
import { FiRefreshCw, FiRotateCcw } from "react-icons/fi";

import { SearchableSelect } from "@/components/ui/SearchableSelect";

import { RestockCancelReasonField } from "./RestockCancelReasonField";
import { getRestockLineProgress } from "./restockProgress";
import { getRemainingAfterToday } from "./restockReceiveForm";
import type { Barang, PurchaseRequestItem } from "./types";
import { canSubstituteRestockItem, getRestockItemExcess } from "./utils";

interface RestockReceiveItemRowProps {
  item: PurchaseRequestItem;
  receivedQuantity: number;
  onReceivedQuantityChange: (quantity: number) => void;
  barangs: Barang[];
  excludedBarangIds: string[];
  substituteBarangId: string | null;
  onSubstituteChange: (barangId: string | null) => void;
  /** null = masih ditunggu, "" = ditandai tidak datang tapi alasan belum diisi. */
  cancelReason: string | null;
  onCancelReasonChange: (reason: string | null) => void;
  /** Tanda "tidak akan datang" per barang hanya ada saat jawaban bagian 3 "Ya". */
  canMarkNotComing: boolean;
  overReceiptReason: string;
  onOverReceiptReasonChange: (reason: string) => void;
  /** Jumlah yang boleh dicatat datang sekarang untuk barang ini. */
  receiveLimit: number;
  /**
   * true: hanya barang yang sudah dilaporkan dibeli yang bisa dicatat (bukan
   * data lama/pesanan gabungan); kelebihan kiriman tidak tersedia.
   */
  isLimitedToPurchased: boolean;
}

const NOT_PURCHASED_YET_TEXT =
  "Belum dibeli. Bisa dicatat setelah dilaporkan dibeli lewat link.";

/**
 * "Sudah dibeli 6 roll · Sudah datang 2 roll · Bisa dicatat sekarang 4 roll"
 * pada pesanan yang belanjanya lewat link; "Dipesan 10 roll · Sudah datang 6
 * roll · Masih ditunggu 4 roll" pada data lama dan pesanan gabungan.
 */
export function describeReceiveLineProgress(
  item: PurchaseRequestItem,
  purchaseLimit?: { receiveLimit: number },
): string {
  const { ordered, received, remaining } = getRestockLineProgress(item);
  const withUnit = (quantity: number) =>
    [String(quantity), item.barang.satuan].filter(Boolean).join(" ");
  if (purchaseLimit) {
    return `Sudah dibeli ${withUnit(item.purchasedQuantity ?? 0)} · Sudah datang ${withUnit(received)} · Bisa dicatat sekarang ${withUnit(purchaseLimit.receiveLimit)}`;
  }
  const orderedText = `Dipesan ${withUnit(ordered)}`;
  if (received === 0) return `${orderedText} · Belum ada yang datang`;
  return `${orderedText} · Sudah datang ${withUnit(received)} · Masih ditunggu ${withUnit(remaining)}`;
}

/**
 * Satu barang di modal "Catat Barang yang Datang": jumlah yang datang hari
 * ini, ganti barang bila yang datang berbeda, kelebihan, dan tanda tidak datang.
 */
export function RestockReceiveItemRow({
  item,
  receivedQuantity,
  onReceivedQuantityChange,
  barangs,
  excludedBarangIds,
  substituteBarangId,
  onSubstituteChange,
  cancelReason,
  onCancelReasonChange,
  canMarkNotComing,
  overReceiptReason,
  onOverReceiptReasonChange,
  receiveLimit,
  isLimitedToPurchased,
}: RestockReceiveItemRowProps) {
  const inputId = useId();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const canSubstitute = canSubstituteRestockItem(item);
  const substituteBarang = substituteBarangId
    ? barangs.find((barang) => barang.id === substituteBarangId)
    : undefined;
  const isPickerVisible = isPickerOpen || !!substituteBarangId;

  const barangOptions = useMemo(
    () =>
      barangs
        .filter((barang) => !excludedBarangIds.includes(barang.id))
        .map((barang) => ({
          value: barang.id,
          label: barang.nama,
          subLabel: `${barang.kode} • ${barang.satuan}`,
        })),
    [barangs, excludedBarangIds],
  );

  const satuan = item.barang.satuan;
  const displayedName = substituteBarang?.nama ?? item.barang.nama;
  const displayedSatuan = substituteBarang?.satuan ?? satuan;
  const { remaining, received, cancelled } = getRestockLineProgress(item);
  const outstandingQuantity = getRemainingAfterToday(item, receivedQuantity);
  const excessQuantity = isLimitedToPurchased
    ? 0
    : getRestockItemExcess(item, receivedQuantity);
  const prefillQuantity = isLimitedToPurchased ? receiveLimit : remaining;
  const isPrefilledWithRemaining =
    prefillQuantity > 0 && receivedQuantity === prefillQuantity;
  const isNotPurchasedYet = isLimitedToPurchased && receiveLimit === 0;
  const isInputDisabled = isNotPurchasedYet && receivedQuantity === 0;
  const isNotArrivingToday = receivedQuantity <= 0;
  // Barang yang belum dibeli tidak mungkin datang sebagai barang lain.
  const isSubstituteOffered =
    canSubstitute && (!isNotPurchasedYet || !!substituteBarangId);
  const notPurchasedId = useId();

  return (
    <div
      className={`rounded-2xl border p-4 ${isNotArrivingToday ? "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40" : "border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-gray-900 dark:text-white">
              {displayedName}
            </span>
            {substituteBarang && (
              <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                Barang diganti
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {describeReceiveLineProgress(
              item,
              isLimitedToPurchased ? { receiveLimit } : undefined,
            )}
          </p>
          {isNotPurchasedYet && (
            <p
              id={notPurchasedId}
              className="text-sm font-semibold text-amber-900 dark:text-amber-200"
            >
              {NOT_PURCHASED_YET_TEXT}
            </p>
          )}
        </div>
        <div className="shrink-0">
          <label
            htmlFor={inputId}
            className="block text-sm font-bold text-gray-800 dark:text-gray-100"
          >
            Datang hari ini
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={inputId}
              type="number"
              min="0"
              inputMode="numeric"
              aria-label={`Jumlah ${displayedName} yang datang hari ini`}
              aria-describedby={isNotPurchasedYet ? notPurchasedId : undefined}
              disabled={isInputDisabled}
              max={isLimitedToPurchased ? receiveLimit : undefined}
              value={receivedQuantity}
              onChange={(event) =>
                onReceivedQuantityChange(
                  Math.max(parseInt(event.target.value) || 0, 0),
                )
              }
              className="min-h-[44px] w-24 rounded-xl border border-gray-300 bg-white px-3 text-right text-base font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800 dark:disabled:text-gray-400"
            />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {displayedSatuan}
            </span>
          </div>
        </div>
      </div>

      {isPrefilledWithRemaining && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          {isLimitedToPurchased
            ? "Sudah terisi semua yang sudah dibeli. Ubah kalau yang datang lebih sedikit."
            : "Sudah terisi semua sisa. Ubah kalau yang datang lebih sedikit."}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {isSubstituteOffered ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (substituteBarangId) {
                  onSubstituteChange(null);
                  setIsPickerOpen(false);
                  return;
                }
                setIsPickerOpen((previous) => !previous);
              }}
              className="flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-800 dark:text-indigo-300 sm:min-h-0"
            >
              {substituteBarangId ? (
                <FiRotateCcw aria-hidden="true" />
              ) : (
                <FiRefreshCw aria-hidden="true" />
              )}
              {substituteBarangId
                ? `Kembalikan ke ${item.barang.nama}`
                : "Yang datang barang lain? Pilih barangnya"}
            </button>
            {isPickerVisible && (
              <SearchableSelect
                options={barangOptions}
                value={substituteBarangId ?? ""}
                onChange={(value) => onSubstituteChange(value || null)}
                placeholder="Cari barang pengganti..."
              />
            )}
          </>
        ) : (
          !canSubstitute && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Sudah datang {received} {satuan} sebelumnya, jadi barangnya tidak
              bisa diganti lagi.
            </p>
          )
        )}

        {cancelled > 0 && (
          <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
            Tidak jadi datang: {cancelled} {satuan}
            {item.cancelReason ? ` (${item.cancelReason})` : ""}
          </p>
        )}

        {excessQuantity > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Datang {excessQuantity} {displayedSatuan} lebih banyak dari
              pesanan. Kalau diterima, kelebihannya ikut dibayar ke toko. Tulis
              alasannya.
            </p>
            <input
              type="text"
              value={overReceiptReason}
              maxLength={255}
              aria-label={`Alasan kelebihan ${displayedName}`}
              placeholder="Contoh: bonus dari toko, salah kirim"
              onChange={(event) =>
                onOverReceiptReasonChange(event.target.value)
              }
              className="mt-2 min-h-[44px] w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-gray-900"
            />
            <p className="mt-2 text-xs text-amber-900 dark:text-amber-200">
              Tidak mau membayar kelebihannya? Kembalikan ke toko, lalu isi
              jumlah sesuai pesanan.
            </p>
          </div>
        )}

        {canMarkNotComing &&
          (outstandingQuantity > 0 || cancelReason !== null) && (
            <RestockCancelReasonField
              itemName={displayedName}
              satuan={displayedSatuan}
              remainingQuantity={outstandingQuantity}
              reason={cancelReason}
              onReasonChange={onCancelReasonChange}
            />
          )}
      </div>
    </div>
  );
}
