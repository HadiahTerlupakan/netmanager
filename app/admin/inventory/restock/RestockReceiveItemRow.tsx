"use client";

import { useId, useMemo, useState } from "react";
import { FiRefreshCw, FiRotateCcw } from "react-icons/fi";

import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { getRestockLineProgress } from "@/modules/inventory/client";

import {
  clampEnteredQuantity,
  getNotEnteredQuantity,
} from "./restockReceiveForm";
import type { Barang, PurchaseRequestItem } from "./types";
import {
  canSubstituteRestockItem,
  getRestockItemExcess,
  getRestockItemRemaining,
} from "./utils";

interface RestockReceiveItemRowProps {
  item: PurchaseRequestItem;
  /** Patokan baris ini (`getRestockEntryBasis`): isian awal dan dasar "tidak dimasukkan". */
  entryBasis: number;
  /** Pesanannya juga dipakai pengajuan lain; jumlah pesanannya tidak ditampilkan. */
  isMergedOrder: boolean;
  enteredQuantity: number;
  onEnteredQuantityChange: (quantity: number) => void;
  barangs: Barang[];
  excludedBarangIds: string[];
  substituteBarangId: string | null;
  onSubstituteChange: (barangId: string | null) => void;
  overReceiptReason: string;
  onOverReceiptReasonChange: (reason: string) => void;
  /** Izin `purchase_orders:update`: boleh mengisi lebih dari sisa pesanan. */
  canOverReceive: boolean;
}

/** "10 roll"; tanpa satuan bila data barangnya tidak lengkap. */
function formatQuantity(quantity: number, satuan: string): string {
  return [String(quantity), satuan].filter(Boolean).join(" ");
}

interface LineProgressInput {
  item: PurchaseRequestItem;
  entryBasis: number;
  isMergedOrder: boolean;
}

/**
 * Angka di bawah nama barang, cukup untuk memahami isian awalnya:
 * "Disetujui 10 roll"; pesanan milik satu pengajuan yang jumlahnya diubah:
 * "Disetujui 10 roll · Dipesan 15 roll"; pengajuan lama yang sudah menerima
 * sebagian: "Disetujui 10 roll · Sudah masuk 4 roll · Sisa 6 roll". Jumlah
 * pesanan gabungan tidak ditampilkan karena ikut memuat pengajuan lain.
 */
function describeReceiveLineProgress({
  item,
  entryBasis,
  isMergedOrder,
}: LineProgressInput): string {
  const satuan = item.barang.satuan;
  const { ordered, received } = getRestockLineProgress(item);
  const isOrderChanged = !isMergedOrder && ordered !== item.jumlah;
  const parts = [`Disetujui ${formatQuantity(item.jumlah, satuan)}`];
  if (isOrderChanged) parts.push(`Dipesan ${formatQuantity(ordered, satuan)}`);
  if (received > 0) {
    parts.push(`Sudah masuk ${formatQuantity(received, satuan)}`);
  }
  const shownTarget = isOrderChanged ? ordered : item.jumlah;
  if (received > 0 || entryBasis !== shownTarget) {
    parts.push(`Sisa ${formatQuantity(entryBasis, satuan)}`);
  }
  return parts.join(" · ");
}

/**
 * Patokan jumlah dalam kalimat: "jumlah yang disetujui" selama angkanya sama
 * dengan yang disetujui dan belum ada yang masuk, selain itu "sisa pesanan".
 */
function describeQuantityReference(
  item: PurchaseRequestItem,
  quantity: number,
): string {
  const isApprovedQuantity =
    quantity === item.jumlah && getRestockLineProgress(item).received === 0;
  return isApprovedQuantity ? "jumlah yang disetujui" : "sisa pesanan";
}

interface QuantityHintInput {
  item: PurchaseRequestItem;
  entryBasis: number;
  enteredQuantity: number;
  satuan: string;
  canOverReceive: boolean;
}

const OVER_RECEIPT_LOCKED_HINT =
  "Lebih dari ini hanya bisa dicatat petugas yang boleh mengubah pesanan.";

/**
 * Petunjuk di bawah kolom jumlah: berapa yang tidak dimasukkan bila diisi
 * kurang, atau bahwa isian sudah sesuai patokannya. Tanpa izin kelebihan,
 * petugas yang sudah di batas sisa pesanan diberi tahu kenapa angkanya tidak
 * bisa dinaikkan. Kelebihan dijelaskan kotaknya sendiri, jadi tanpa petunjuk.
 */
function describeQuantityHint({
  item,
  entryBasis,
  enteredQuantity,
  satuan,
  canOverReceive,
}: QuantityHintInput): string | null {
  const notEntered = getNotEnteredQuantity(entryBasis, enteredQuantity);
  if (notEntered > 0) {
    return `${formatQuantity(notEntered, satuan)} tidak dimasukkan.`;
  }
  if (getRestockItemExcess(item, enteredQuantity) > 0) return null;
  const hints: string[] = [];
  if (enteredQuantity === entryBasis) {
    hints.push(
      `Terisi sesuai ${describeQuantityReference(item, entryBasis)}. Ubah kalau yang masuk lebih sedikit.`,
    );
  }
  if (!canOverReceive && enteredQuantity >= getRestockItemRemaining(item)) {
    hints.push(OVER_RECEIPT_LOCKED_HINT);
  }
  return hints.length > 0 ? hints.join(" ") : null;
}

/**
 * Satu barang di modal "Masukkan Barang": jumlah yang masuk gudang, ganti
 * barang bila yang masuk berbeda, dan alasan bila masuk lebih banyak.
 */
export function RestockReceiveItemRow({
  item,
  entryBasis,
  isMergedOrder,
  enteredQuantity,
  onEnteredQuantityChange,
  barangs,
  excludedBarangIds,
  substituteBarangId,
  onSubstituteChange,
  overReceiptReason,
  onOverReceiptReasonChange,
  canOverReceive,
}: RestockReceiveItemRowProps) {
  const inputId = useId();
  const hintId = useId();
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
  const { received, cancelled } = getRestockLineProgress(item);
  const excessQuantity = getRestockItemExcess(item, enteredQuantity);
  const excessReference = describeQuantityReference(
    item,
    getRestockItemRemaining(item),
  );
  const quantityHint = describeQuantityHint({
    item,
    entryBasis,
    enteredQuantity,
    satuan: displayedSatuan,
    canOverReceive,
  });
  const isNotEntering = enteredQuantity <= 0;

  return (
    <div
      className={`rounded-2xl border p-4 ${isNotEntering ? "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40" : "border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"}`}
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
            {describeReceiveLineProgress({ item, entryBasis, isMergedOrder })}
          </p>
        </div>
        <div className="shrink-0">
          <label
            htmlFor={inputId}
            className="block text-sm font-bold text-gray-800 dark:text-gray-100"
          >
            Jumlah masuk
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={inputId}
              type="number"
              min="0"
              max={canOverReceive ? undefined : getRestockItemRemaining(item)}
              inputMode="numeric"
              aria-label={`Jumlah ${displayedName} yang masuk`}
              aria-describedby={quantityHint ? hintId : undefined}
              value={enteredQuantity}
              onChange={(event) =>
                onEnteredQuantityChange(
                  clampEnteredQuantity(
                    item,
                    parseInt(event.target.value) || 0,
                    canOverReceive,
                  ),
                )
              }
              className="min-h-[44px] w-24 rounded-xl border border-gray-300 bg-white px-3 text-right text-base font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {displayedSatuan}
            </span>
          </div>
        </div>
      </div>

      {quantityHint && (
        <p
          id={hintId}
          className="mt-2 text-xs text-gray-600 dark:text-gray-400"
        >
          {quantityHint}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {canSubstitute ? (
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
                : "Yang masuk barang lain? Pilih barangnya"}
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
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Sudah masuk {formatQuantity(received, satuan)} sebelumnya, jadi
            barangnya tidak bisa diganti lagi.
          </p>
        )}

        {cancelled > 0 && (
          <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
            Sebelumnya tidak masuk: {formatQuantity(cancelled, satuan)}
            {item.cancelReason ? ` (${item.cancelReason})` : ""}
          </p>
        )}

        {excessQuantity > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Masuk {formatQuantity(excessQuantity, displayedSatuan)} lebih
              banyak dari {excessReference}. Kalau diterima, kelebihannya ikut
              dibayar ke toko. Tulis alasannya.
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
              sesuai {excessReference}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
