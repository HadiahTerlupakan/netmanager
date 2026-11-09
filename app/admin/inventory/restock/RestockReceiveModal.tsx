"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { FiCheck, FiInfo } from "react-icons/fi";

import { Modal } from "@/components/ui/Modal";
import {
  PhotoUpload,
  type PhotoUploadRef,
  type UploadedPhoto,
} from "@/components/inventory/PhotoUpload";

import { RestockProblemList } from "./RestockProblemList";
import { RestockReceiveItemRow } from "./RestockReceiveItemRow";
import {
  RestockFollowUpSection,
  RestockReceiveSummaryPanel,
  RestockShortfallConfirm,
} from "./RestockReceiveSections";
import { RestockStatusBadge } from "./RestockStatusBadge";
import { getRestockPurchaseState } from "./restockPurchase";
import {
  fillAllRemaining,
  getRestockReceiveProblems,
  getRestockReceiveSubmitLabel,
  getRestockReceiveSummary,
  isRestockFinishCancellingOrder,
  needsRestockShortfallConfirm,
  type RestockReceiveMode,
} from "./restockReceiveForm";
import type {
  Barang,
  PurchaseRequest,
  RestockCancellationMap,
  RestockOverReceiptMap,
  RestockSubstitutionMap,
} from "./types";
import { getReceivableRestockItems } from "./utils";

const MAX_PROOF_PHOTOS = 3;

interface RestockReceiveModalProps {
  request: PurchaseRequest | null;
  receivedItems: Record<string, number>;
  onReceivedItemsChange: (items: Record<string, number>) => void;
  barangs: Barang[];
  substitutions: RestockSubstitutionMap;
  onSubstitutionsChange: (substitutions: RestockSubstitutionMap) => void;
  cancellations: RestockCancellationMap;
  onCancellationsChange: (cancellations: RestockCancellationMap) => void;
  overReceipts: RestockOverReceiptMap;
  onOverReceiptsChange: (overReceipts: RestockOverReceiptMap) => void;
  receivedPhotos: UploadedPhoto[];
  onReceivedPhotosChange: (photos: UploadedPhoto[]) => void;
  /** true = jawaban "Tidak, sisanya tidak akan datang". */
  isFinishingOrder: boolean;
  onIsFinishingOrderChange: (value: boolean) => void;
  closeReason: string;
  onCloseReasonChange: (reason: string) => void;
  submitting: boolean;
  photoUploadRef: RefObject<PhotoUploadRef | null>;
  onClose: () => void;
  onSubmit: () => void;
}

function updateKeyedMap<T>(
  map: Record<string, T>,
  key: string,
  value: T | null,
): Record<string, T> {
  const next = { ...map };
  if (value === null) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

interface RestockReceiveHeaderProps {
  request: PurchaseRequest;
  mode: RestockReceiveMode;
  isCancellingOrder: boolean;
}

/** Catatan pembelian di kepala modal, mengikuti hasil penyimpanan nanti. */
function getPurchaseNote({
  request,
  mode,
  isCancellingOrder,
}: RestockReceiveHeaderProps): string | null {
  if (isCancellingOrder) {
    return "Belum ada barang yang datang. Kalau disimpan, pesanan ini dibatalkan.";
  }
  if (mode === "FINISH_WITHOUT_DELIVERY") return null;
  if (getRestockPurchaseState(request) !== "NONE") return null;
  return "Belum ada catatan belanja. Tidak apa-apa, barang yang datang dihitung sudah dibeli.";
}

function RestockReceiveHeader(props: RestockReceiveHeaderProps) {
  const { request } = props;
  const poNumber = request.purchaseOrder?.poNumber;
  const purchaseNote = getPurchaseNote(props);
  return (
    <div className="space-y-2 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/30">
      <p className="text-lg font-bold text-indigo-950 dark:text-indigo-100">
        Pengajuan {request.nomorRequest}
      </p>
      {poNumber && (
        <p className="text-xs text-gray-700 dark:text-gray-300">
          Kode pesanan: {poNumber}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <RestockStatusBadge request={request} />
        <span className="text-sm text-gray-800 dark:text-gray-200">
          Masuk ke gudang: {request.gudang?.nama || "-"}
        </span>
      </div>
      {purchaseNote && (
        <p className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">
          <FiInfo aria-hidden="true" className="mt-0.5 shrink-0" />
          {purchaseNote}
        </p>
      )}
    </div>
  );
}

/**
 * Modal "Catat Barang yang Datang": isi jumlah per barang, foto, lalu jawab
 * apakah sisanya masih akan datang. Ringkasan dan alasan tombol mati selalu
 * terlihat di atas tombol simpan.
 */
export function RestockReceiveModal({
  request,
  receivedItems,
  onReceivedItemsChange,
  barangs,
  substitutions,
  onSubstitutionsChange,
  cancellations,
  onCancellationsChange,
  overReceipts,
  onOverReceiptsChange,
  receivedPhotos,
  onReceivedPhotosChange,
  isFinishingOrder,
  onIsFinishingOrderChange,
  closeReason,
  onCloseReasonChange,
  submitting,
  photoUploadRef,
  onClose,
  onSubmit,
}: RestockReceiveModalProps) {
  const [isConfirmingShortfall, setIsConfirmingShortfall] = useState(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingRef = useRef(false);

  // Tombol simpan baru terpasang lagi setelah konfirmasi tertutup, jadi fokus
  // dikembalikan sesudah render, bukan di handler.
  useEffect(() => {
    if (wasConfirmingRef.current && !isConfirmingShortfall) {
      submitButtonRef.current?.focus();
    }
    wasConfirmingRef.current = isConfirmingShortfall;
  }, [isConfirmingShortfall]);

  if (!request) return null;

  const formInput = {
    request,
    receivedItems,
    substitutions,
    cancellations,
    isFinishingOrder,
    barangs,
  };
  const summary = getRestockReceiveSummary(formInput);
  const problems = getRestockReceiveProblems({
    ...formInput,
    overReceipts,
    closeReason,
    photoCount: receivedPhotos.length,
  });
  // Baris yang ditolak atasan tidak dibeli, jadi tidak ikut dicatat datang.
  const receivableItems = getReceivableRestockItems(request);
  const orderedBarangIds = receivableItems.map((item) => item.barangId);
  const substitutedCount = Object.keys(substitutions).length;
  const isPhotoNeeded = summary.mode !== "FINISH_WITHOUT_DELIVERY";
  const isCancellingOrder = isRestockFinishCancellingOrder(request, summary);
  const isSubmitDisabled = submitting || problems.length > 0;

  const handleSubmitClick = () => {
    if (isSubmitDisabled) return;
    if (needsRestockShortfallConfirm(summary, isFinishingOrder)) {
      setIsConfirmingShortfall(true);
      return;
    }
    onSubmit();
  };

  const handleConfirmBack = () => {
    setIsConfirmingShortfall(false);
  };

  // Escape di dialog konfirmasi berarti "Kembali", bukan menutup seluruh isian.
  const handleModalClose = () => {
    if (submitting) return;
    if (isConfirmingShortfall) {
      handleConfirmBack();
      return;
    }
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={handleModalClose}
      title="Catat Barang yang Datang"
      size="2xl"
    >
      <div className="space-y-6 p-4 sm:p-6">
        <RestockReceiveHeader
          request={request}
          mode={summary.mode}
          isCancellingOrder={isCancellingOrder}
        />

        <section className="space-y-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            1. Barang apa yang datang hari ini?
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Hitung barangnya, lalu isi jumlahnya. Barang yang belum datang, isi
            0.
          </p>
          <button
            type="button"
            onClick={() =>
              onReceivedItemsChange(fillAllRemaining(request, receivedItems))
            }
            className="min-h-[44px] rounded-2xl border border-indigo-200 bg-white px-4 py-2 text-sm font-bold text-indigo-800 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-gray-800 dark:text-indigo-200"
          >
            Semua datang lengkap
          </button>
          <div className="space-y-3">
            {receivableItems.map((item) => (
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
                  onSubstitutionsChange(
                    updateKeyedMap(substitutions, item.barangId, barangId),
                  )
                }
                cancelReason={cancellations[item.barangId] ?? null}
                onCancelReasonChange={(reason) =>
                  onCancellationsChange(
                    updateKeyedMap(cancellations, item.barangId, reason),
                  )
                }
                canMarkNotComing={summary.allowsLineCancellation}
                overReceiptReason={overReceipts[item.barangId] ?? ""}
                onOverReceiptReasonChange={(reason) =>
                  onOverReceiptsChange({
                    ...overReceipts,
                    [item.barangId]: reason,
                  })
                }
              />
            ))}
          </div>
          {substitutedCount > 0 && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              {substitutedCount} barang diganti dengan barang lain yang datang.
              Catatan pesanan ikut disesuaikan.
            </p>
          )}
        </section>

        {/* Tetap terpasang saat disembunyikan: PhotoUpload menyimpan fotonya
            sendiri, dan jumlah foto di induk harus tetap cocok dengannya. */}
        <section className="space-y-3" hidden={!isPhotoNeeded}>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            2. Foto barang yang datang (wajib, paling banyak {MAX_PROOF_PHOTOS}{" "}
            foto)
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Foto barangnya. Kalau ada nota atau surat jalan, ikut difoto.
          </p>
          <div className="rounded-3xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <PhotoUpload
              ref={photoUploadRef}
              onPhotosChange={onReceivedPhotosChange}
              maxPhotos={MAX_PROOF_PHOTOS}
              transactionType="inventory-masuk"
            />
          </div>
        </section>

        <RestockFollowUpSection
          summary={summary}
          stepNumber={isPhotoNeeded ? 3 : 2}
          isCancellingOrder={isCancellingOrder}
          isFinishingOrder={isFinishingOrder}
          onIsFinishingOrderChange={(value) => {
            setIsConfirmingShortfall(false);
            onIsFinishingOrderChange(value);
          }}
          closeReason={closeReason}
          onCloseReasonChange={onCloseReasonChange}
        />

        <RestockReceiveSummaryPanel summary={summary} />

        <div className="sticky bottom-0 -mx-4 space-y-3 bg-white px-4 pb-1 pt-3 dark:bg-gray-800 sm:-mx-6 sm:px-6">
          {problems.length > 0 && !submitting && (
            <RestockProblemList
              title="Belum bisa disimpan:"
              problems={problems}
            />
          )}
          {isConfirmingShortfall ? (
            <RestockShortfallConfirm
              summary={summary}
              isCancellingOrder={isCancellingOrder}
              onBack={handleConfirmBack}
              onConfirm={() => {
                setIsConfirmingShortfall(false);
                onSubmit();
              }}
            />
          ) : (
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="min-h-[44px] flex-1 rounded-2xl bg-gray-100 px-4 py-3 font-bold text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100"
              >
                Tutup
              </button>
              <button
                ref={submitButtonRef}
                type="button"
                onClick={handleSubmitClick}
                // Saat menyimpan tombol tetap bisa difokus (aria-disabled),
                // supaya fokus tidak jatuh ke body sesudah konfirmasi.
                disabled={isSubmitDisabled && !submitting}
                aria-disabled={isSubmitDisabled}
                className="flex min-h-[44px] flex-[2] items-center justify-center gap-2 rounded-2xl bg-green-700 px-4 py-3 font-bold text-white shadow-lg hover:bg-green-800 disabled:opacity-50 aria-disabled:opacity-50"
              >
                {submitting ? (
                  "Menyimpan..."
                ) : (
                  <>
                    <FiCheck aria-hidden="true" />
                    {getRestockReceiveSubmitLabel(
                      summary.mode,
                      isCancellingOrder,
                    )}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
