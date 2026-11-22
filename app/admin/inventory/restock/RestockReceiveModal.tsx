"use client";

import { useEffect, useRef, useState } from "react";
import { FiCheck } from "react-icons/fi";

import { Modal } from "@/components/ui/Modal";
import { PhotoUpload } from "@/components/inventory/PhotoUpload";
import {
  isRestockLineRejected,
  isRestockMergedOrder,
} from "@/modules/inventory/client";

import { RestockProblemList } from "./RestockProblemList";
import { RestockReceiveItemRow } from "./RestockReceiveItemRow";
import {
  RestockReceiveSummaryPanel,
  RestockShortfallConfirm,
} from "./RestockReceiveSections";
import { RestockStatusBadge } from "./RestockStatusBadge";
import {
  ENTER_GOODS_LABEL,
  getRestockReceiveProblems,
  getRestockReceiveSubmitLabel,
  getRestockReceiveSummary,
  needsRestockShortfallConfirm,
} from "./restockReceiveForm";
import type { Barang, PurchaseRequest } from "./types";
import type { RestockEntryState } from "./useRestockEntry";
import {
  getPendingJasaItems,
  getRestockEnterableItems,
  getRestockEntryBasis,
} from "./utils";

const MAX_PROOF_PHOTOS = 3;

interface RestockReceiveModalProps {
  entry: RestockEntryState;
  /** Semua barang, untuk memilih barang pengganti. */
  barangs: Barang[];
  /** Izin `purchase_orders:update`: boleh mencatat barang lebih dari sisa. */
  canOverReceive: boolean;
}

interface RestockReceiveDialogProps extends RestockReceiveModalProps {
  request: PurchaseRequest;
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

function RestockReceiveHeader({ request }: { request: PurchaseRequest }) {
  const poNumber = request.purchaseOrder?.poNumber;
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
          Gudang tujuan: {request.gudang?.nama || "-"}
        </span>
      </div>
    </div>
  );
}

/**
 * Konfirmasi kekurangan ada di dalam modal. Fokus dikembalikan ke tombol
 * simpan hanya saat konfirmasi ditutup lewat tombolnya (atau Escape), bukan
 * saat petugas sedang mengetik jumlah.
 */
function useShortfallConfirm() {
  const [isConfirming, setIsConfirming] = useState(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const isReturningFocusRef = useRef(false);

  // Tombol simpan baru terpasang lagi setelah konfirmasi tertutup, jadi fokus
  // dikembalikan sesudah render, bukan di handler.
  useEffect(() => {
    if (isConfirming || !isReturningFocusRef.current) return;
    isReturningFocusRef.current = false;
    submitButtonRef.current?.focus();
  }, [isConfirming]);

  return {
    isConfirming,
    submitButtonRef,
    openConfirm: () => setIsConfirming(true),
    dismissConfirm: () => setIsConfirming(false),
    closeConfirmAndFocusSubmit: () => {
      isReturningFocusRef.current = true;
      setIsConfirming(false);
    },
  };
}

function RestockReceiveDialog({
  entry,
  request,
  barangs,
  canOverReceive,
}: RestockReceiveDialogProps) {
  const {
    receivedItems,
    setReceivedItems,
    substitutions,
    setSubstitutions,
    overReceipts,
    setOverReceipts,
    photos,
    setPhotos,
    photoUploadRef,
    isSubmitting,
    close,
    submit,
  } = entry;
  const {
    isConfirming,
    submitButtonRef,
    openConfirm,
    dismissConfirm,
    closeConfirmAndFocusSubmit,
  } = useShortfallConfirm();
  const formInput = { request, receivedItems, substitutions, barangs };
  const summary = getRestockReceiveSummary(formInput);
  const problems = getRestockReceiveProblems({
    ...formInput,
    overReceipts,
    photoCount: photos.length,
  });
  const enterableItems = getRestockEnterableItems(request);
  const isMergedOrder = isRestockMergedOrder(request);
  // Barang pengganti tidak boleh sama dengan barang baris lain yang dipesan.
  const orderedBarangIds = request.items
    .filter((item) => !isRestockLineRejected(item))
    .map((item) => item.barangId);
  const substitutedCount = Object.keys(substitutions).length;
  const isSubmitDisabled = isSubmitting || problems.length > 0;

  const handleSubmitClick = () => {
    if (isSubmitDisabled) return;
    if (needsRestockShortfallConfirm(summary)) {
      openConfirm();
      return;
    }
    void submit();
  };

  // Escape di dialog konfirmasi berarti "Kembali", bukan menutup seluruh isian.
  const handleModalClose = () => {
    if (isSubmitting) return;
    if (isConfirming) {
      closeConfirmAndFocusSubmit();
      return;
    }
    close();
  };

  return (
    <Modal
      isOpen
      onClose={handleModalClose}
      title={ENTER_GOODS_LABEL}
      size="2xl"
    >
      <div className="space-y-6 p-4 sm:p-6">
        <RestockReceiveHeader request={request} />

        <section className="space-y-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            1. Berapa barang yang masuk?
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {canOverReceive
              ? "Jumlah sudah terisi sesuai sisa yang belum sampai. Ubah kalau yang sampai lebih sedikit atau lebih banyak."
              : "Jumlah sudah terisi sesuai sisa yang belum sampai. Ubah kalau yang sampai lebih sedikit."}
          </p>
          <div className="space-y-3">
            {enterableItems.map((item) => (
              <RestockReceiveItemRow
                key={item.id}
                item={item}
                entryBasis={getRestockEntryBasis(item, request)}
                isMergedOrder={isMergedOrder}
                enteredQuantity={receivedItems[item.barangId] || 0}
                onEnteredQuantityChange={(quantity) => {
                  dismissConfirm();
                  setReceivedItems({
                    ...receivedItems,
                    [item.barangId]: quantity,
                  });
                }}
                barangs={barangs}
                excludedBarangIds={orderedBarangIds}
                substituteBarangId={substitutions[item.barangId] ?? null}
                onSubstituteChange={(barangId) => {
                  dismissConfirm();
                  setSubstitutions(
                    updateKeyedMap(substitutions, item.barangId, barangId),
                  );
                }}
                overReceiptReason={overReceipts[item.barangId] ?? ""}
                onOverReceiptReasonChange={(reason) =>
                  setOverReceipts({ ...overReceipts, [item.barangId]: reason })
                }
                canOverReceive={canOverReceive}
              />
            ))}
          </div>
          {substitutedCount > 0 && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              {substitutedCount} barang diganti dengan barang lain yang masuk.
              Catatan pesanan ikut disesuaikan.
            </p>
          )}
        </section>

        {/* Tetap terpasang saat disembunyikan: PhotoUpload menyimpan fotonya
            sendiri, dan jumlah foto di induk harus tetap cocok dengannya. */}
        <section className="space-y-3" hidden={!summary.hasEntry}>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            2. Foto bukti barang (wajib, paling banyak {MAX_PROOF_PHOTOS} foto)
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Foto barangnya. Kalau ada nota atau surat jalan, ikut difoto.
          </p>
          <div className="rounded-3xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <PhotoUpload
              ref={photoUploadRef}
              onPhotosChange={setPhotos}
              maxPhotos={MAX_PROOF_PHOTOS}
              transactionType="inventory-masuk"
            />
          </div>
        </section>

        <RestockReceiveSummaryPanel
          summary={summary}
          hasPendingJasa={getPendingJasaItems(request).length > 0}
          isMergedOrder={isMergedOrder}
        />

        <div className="sticky bottom-0 -mx-4 space-y-3 bg-white px-4 pb-1 pt-3 dark:bg-gray-800 sm:-mx-6 sm:px-6">
          {problems.length > 0 && !isSubmitting && (
            <RestockProblemList
              title="Belum bisa disimpan:"
              problems={problems}
            />
          )}
          {isConfirming ? (
            <RestockShortfallConfirm
              summary={summary}
              onBack={closeConfirmAndFocusSubmit}
              onConfirm={() => {
                closeConfirmAndFocusSubmit();
                void submit();
              }}
            />
          ) : (
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={close}
                disabled={isSubmitting}
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
                disabled={isSubmitDisabled && !isSubmitting}
                aria-disabled={isSubmitDisabled}
                className="flex min-h-[44px] flex-[2] items-center justify-center gap-2 rounded-2xl bg-green-700 px-4 py-3 font-bold text-white shadow-lg hover:bg-green-800 disabled:opacity-50 aria-disabled:opacity-50"
              >
                {isSubmitting ? (
                  "Menyimpan..."
                ) : (
                  <>
                    <FiCheck aria-hidden="true" />
                    {getRestockReceiveSubmitLabel(summary)}
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

/**
 * Modal "Lapor Barang Sampai": isi jumlah per barang (terisi sesuai sisa), foto
 * bukti, lalu simpan sekali untuk menyelesaikan pengajuan. Ringkasan dan
 * alasan tombol mati selalu terlihat di atas tombol simpan; konfirmasi hanya
 * muncul bila ada barang yang masuk kurang dari sisanya.
 */
export function RestockReceiveModal(props: RestockReceiveModalProps) {
  if (!props.entry.request) return null;
  return <RestockReceiveDialog {...props} request={props.entry.request} />;
}
