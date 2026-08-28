"use client";

import { useMemo, useState } from "react";
import { FiRefreshCw, FiRotateCcw } from "react-icons/fi";

import { SearchableSelect } from "@/components/ui/SearchableSelect";

import { RestockCancelReasonField } from "./RestockCancelReasonField";
import type { Barang, PurchaseRequestItem } from "./types";
import { canSubstituteRestockItem, getRestockItemRemaining } from "./utils";

interface RestockReceiveItemRowProps {
  item: PurchaseRequestItem;
  receivedQuantity: number;
  onReceivedQuantityChange: (quantity: number) => void;
  barangs: Barang[];
  excludedBarangIds: string[];
  substituteBarangId: string | null;
  onSubstituteChange: (barangId: string | null) => void;
  /** null = tidak dianulir, "" = ditandai anulir tapi alasan belum diisi. */
  cancelReason: string | null;
  onCancelReasonChange: (reason: string | null) => void;
}

/**
 * Satu baris verifikasi kedatangan: atur jumlah diterima dan, bila barang yang
 * sampai berbeda dari pesanan, ganti barangnya sebelum stok dicatat.
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
}: RestockReceiveItemRowProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const isExcluded = receivedQuantity <= 0;
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

  const displayedName = substituteBarang?.nama ?? item.barang.nama;
  const displayedSatuan = substituteBarang?.satuan ?? item.barang.satuan;
  const outstandingQuantity = Math.max(
    getRestockItemRemaining(item) - receivedQuantity,
    0,
  );
  const cancelledQuantity = item.cancelledQuantity ?? 0;

  return (
    <div
      className={`p-4 rounded-2xl border transition-all ${isExcluded ? "bg-gray-50/50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 opacity-60" : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm hover:border-indigo-200"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <input
            type="checkbox"
            checked={!isExcluded}
            aria-label={`Sertakan ${item.barang.nama}`}
            onChange={(event) => {
              const remaining = item.jumlah - item.receivedQuantity;
              const nextValue = event.target.checked
                ? remaining > 0
                  ? remaining
                  : 1
                : 0;
              onReceivedQuantityChange(nextValue);
            }}
            className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-bold text-sm ${isExcluded ? "text-gray-400 line-through" : "text-gray-900 dark:text-white"}`}
              >
                {displayedName}
              </span>
              {substituteBarang && (
                <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider">
                  Barang diganti
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 italic">
              Pesanan: {item.barang.nama} — {item.jumlah} {item.barang.satuan}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-bold text-gray-400 uppercase">
            Diterima:
          </span>
          <input
            type="number"
            min="0"
            disabled={isExcluded}
            aria-label={`Jumlah ${item.barang.nama} diterima`}
            value={receivedQuantity}
            onChange={(event) =>
              onReceivedQuantityChange(parseInt(event.target.value) || 0)
            }
            className={`w-20 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-right font-black focus:ring-2 focus:ring-indigo-500 ${isExcluded ? "text-gray-300" : "text-indigo-600"}`}
          />
          <span className="text-[10px] font-bold text-gray-400 uppercase w-10">
            {displayedSatuan}
          </span>
        </div>
      </div>

      <div className="mt-3 pl-9">
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
              className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              {substituteBarangId ? <FiRotateCcw /> : <FiRefreshCw />}
              {substituteBarangId
                ? `Batalkan penggantian ${item.barang.nama}`
                : `Barang yang sampai beda? Ganti ${item.barang.nama}`}
            </button>
            {isPickerVisible && (
              <div className="mt-2">
                <SearchableSelect
                  options={barangOptions}
                  value={substituteBarangId ?? ""}
                  onChange={(value) => onSubstituteChange(value || null)}
                  placeholder="Cari barang pengganti..."
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-[11px] font-semibold text-gray-400">
            Sudah diterima sebagian ({item.receivedQuantity}{" "}
            {item.barang.satuan}), barang tidak bisa diganti.
          </div>
        )}

        {cancelledQuantity > 0 && (
          <div className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
            Sudah dianulir {cancelledQuantity} {item.barang.satuan}
            {item.cancelReason ? ` — ${item.cancelReason}` : ""}
          </div>
        )}

        {(outstandingQuantity > 0 || cancelReason !== null) && (
          <div className="mt-2">
            <RestockCancelReasonField
              itemName={item.barang.nama}
              satuan={item.barang.satuan}
              remainingQuantity={outstandingQuantity}
              reason={cancelReason}
              onReasonChange={onCancelReasonChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
