"use client";

import type { RefObject } from "react";
import { FiCheck, FiEdit2, FiImage } from "react-icons/fi";

import { Modal } from "@/components/ui/Modal";
import {
  PhotoUpload,
  type PhotoUploadRef,
  type UploadedPhoto,
} from "@/components/inventory/PhotoUpload";

import { RestockReceiveItemRow } from "./RestockReceiveItemRow";
import type {
  Barang,
  PurchaseRequest,
  RestockCancellationMap,
  RestockSubstitutionMap,
} from "./types";
import { hasIncompleteCancellationReason } from "./utils";

interface RestockReceiveModalProps {
  request: PurchaseRequest | null;
  receivedItems: Record<string, number>;
  onReceivedItemsChange: (items: Record<string, number>) => void;
  barangs: Barang[];
  substitutions: RestockSubstitutionMap;
  onSubstitutionsChange: (substitutions: RestockSubstitutionMap) => void;
  cancellations: RestockCancellationMap;
  onCancellationsChange: (cancellations: RestockCancellationMap) => void;
  receivedPhotos: UploadedPhoto[];
  onReceivedPhotosChange: (photos: UploadedPhoto[]) => void;
  isFinishingPO: boolean;
  onIsFinishingPOChange: (value: boolean) => void;
  submitting: boolean;
  photoUploadRef: RefObject<PhotoUploadRef | null>;
  onClose: () => void;
  onSubmit: () => void;
}

export function RestockReceiveModal({
  request,
  receivedItems,
  onReceivedItemsChange,
  barangs,
  substitutions,
  onSubstitutionsChange,
  cancellations,
  onCancellationsChange,
  receivedPhotos,
  onReceivedPhotosChange,
  isFinishingPO,
  onIsFinishingPOChange,
  submitting,
  photoUploadRef,
  onClose,
  onSubmit,
}: RestockReceiveModalProps) {
  const hasReceivedItem = Object.values(receivedItems).some(
    (quantity) => quantity > 0,
  );
  const orderedBarangIds = (request?.items ?? []).map((item) => item.barangId);
  const substitutedCount = Object.keys(substitutions).length;
  const cancelledCount = Object.keys(cancellations).length;
  const hasIncompleteReason = hasIncompleteCancellationReason(cancellations);

  const handleCancelReasonChange = (
    barangId: string,
    reason: string | null,
  ) => {
    const next = { ...cancellations };
    if (reason === null) {
      delete next[barangId];
    } else {
      next[barangId] = reason;
    }
    onCancellationsChange(next);
  };

  const handleSubstituteChange = (
    originalBarangId: string,
    replacementBarangId: string | null,
  ) => {
    const next = { ...substitutions };
    if (replacementBarangId) {
      next[originalBarangId] = replacementBarangId;
    } else {
      delete next[originalBarangId];
    }
    onSubstitutionsChange(next);
  };
  const isSubmitDisabled =
    submitting ||
    receivedPhotos.length === 0 ||
    !hasReceivedItem ||
    hasIncompleteReason;
  const disabledReason = hasIncompleteReason
    ? "Lengkapi alasan anulir terlebih dahulu"
    : receivedPhotos.length === 0
      ? "Unggah foto bukti terlebih dahulu"
      : "Minimal satu barang harus diterima";

  return (
    <Modal
      isOpen={!!request}
      onClose={() => !submitting && onClose()}
      title="Verifikasi Barang Sampai"
      size="2xl"
    >
      <div className="p-6 space-y-6">
        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-2xl flex justify-between items-center border border-indigo-100 dark:border-indigo-800">
          <div>
            <div className="text-xs font-bold text-indigo-400 uppercase mb-1">
              Konfirmasi Kedatangan
            </div>
            <div className="font-bold text-indigo-900 dark:text-indigo-200 text-lg">
              {request?.nomorRequest}
            </div>
          </div>
          <FiCheck className="text-indigo-600 w-10 h-10" />
        </div>

        <div className="space-y-4">
          <div className="font-bold flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 px-1">
            <FiEdit2 /> Revisi Barang &amp; Jumlah Realita
          </div>
          <div className="max-h-[320px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {request?.items.map((item) => (
              <RestockReceiveItemRow
                key={item.id}
                item={item}
                receivedQuantity={receivedItems[item.barangId] || 0}
                onReceivedQuantityChange={(quantity) =>
                  onReceivedItemsChange({
                    ...receivedItems,
                    [item.barangId]: quantity,
                  })
                }
                barangs={barangs}
                excludedBarangIds={orderedBarangIds}
                substituteBarangId={substitutions[item.barangId] ?? null}
                onSubstituteChange={(barangId) =>
                  handleSubstituteChange(item.barangId, barangId)
                }
                cancelReason={cancellations[item.barangId] ?? null}
                onCancelReasonChange={(reason) =>
                  handleCancelReasonChange(item.barangId, reason)
                }
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="font-bold flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 px-1">
            <FiImage /> Foto Bukti Barang Sampai (Wajib)
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <PhotoUpload
              ref={photoUploadRef}
              onPhotosChange={onReceivedPhotosChange}
              maxPhotos={3}
              transactionType="inventory-masuk"
            />
          </div>
        </div>

        {cancelledCount > 0 && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            {cancelledCount} barang dianulir. Sisa pesanannya ditutup beserta
            alasannya, jumlah yang semula dipesan tetap tercatat di PO.
          </div>
        )}

        {substitutedCount > 0 && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            {substitutedCount} barang diganti. Pesanan dan PO ikut diperbarui
            mengikuti barang yang benar-benar datang.
          </div>
        )}

        {!hasReceivedItem && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            Minimal satu barang harus diterima.
          </div>
        )}

        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-5 rounded-3xl border border-yellow-100 dark:border-yellow-800/50">
          <label className="flex items-start gap-4 cursor-pointer group">
            <div className="relative flex items-center mt-1">
              <input
                type="checkbox"
                checked={isFinishingPO}
                onChange={(event) =>
                  onIsFinishingPOChange(event.target.checked)
                }
                className="w-6 h-6 rounded-lg border-2 border-yellow-400 text-yellow-600 focus:ring-yellow-500 transition-all cursor-pointer"
              />
            </div>
            <div className="flex-1">
              <span className="block text-sm font-black text-yellow-800 dark:text-yellow-200 uppercase tracking-tight">
                Tutup Pesanan (Selesai)
              </span>
              <span className="block text-[11px] text-yellow-700/70 dark:text-yellow-400/60 font-medium leading-relaxed mt-0.5">
                Centang jika tidak akan ada pengiriman lagi untuk nomor PO ini
                (meskipun jumlah yang diterima kurang dari yang diajukan).
              </span>
            </div>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitDisabled}
            aria-disabled={isSubmitDisabled}
            title={isSubmitDisabled && !submitting ? disabledReason : undefined}
            className="flex-[2] px-4 py-4 bg-green-600 text-white rounded-2xl font-bold disabled:opacity-50 shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              "Menyimpan..."
            ) : isSubmitDisabled ? (
              disabledReason
            ) : (
              <>
                <FiCheck /> Konfirmasi & Tambah Stok
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
