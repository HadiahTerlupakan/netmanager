"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { FiAlertTriangle, FiCheck } from "react-icons/fi";

import { PhotoUpload } from "@/components/inventory/PhotoUpload";
import { Modal } from "@/components/ui/Modal";
import { RESTOCK_PURCHASE_LIMITS } from "@/lib/validations/restock";

import { RestockPurchaseLineRow } from "./RestockPurchaseLineRow";
import { todayIsoDate } from "./restockPurchaseForm";
import type { RestockPurchaseRecordState } from "./useRestockPurchaseRecord";

interface RestockPurchaseRecordModalProps {
  purchaseRecord: RestockPurchaseRecordState;
  /** Nama pengguna yang sedang masuk; dipakai bila nama pembeli kosong. */
  currentUserName?: string | null;
}

const FIELD_CLASS =
  "min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-indigo-900";
const LABEL_CLASS = "text-sm font-bold text-gray-900 dark:text-white";

/** Simpan tombol pemicu saat dibuka; kembalikan fokus ke sana saat ditutup. */
function useReturnFocus(
  isOpen: boolean,
  initialFocusRef: RefObject<HTMLElement | null>,
) {
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isOpen) {
      // Dibuka dari detail: tombol pemicunya sudah hilang dan fokus ada di
      // body. Pengembalian fokus untuk kasus itu diurus halaman.
      const active = document.activeElement;
      triggerRef.current =
        active instanceof HTMLElement && active !== document.body
          ? active
          : null;
      initialFocusRef.current?.focus();
      return;
    }
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (trigger?.isConnected) trigger.focus();
  }, [initialFocusRef, isOpen]);
}

/**
 * Modal "Catat Belanja": satu kali belanja di satu toko. Petugas mencentang
 * barang yang dibeli di toko ini, jumlahnya, dan boleh melampirkan foto nota.
 */
export function RestockPurchaseRecordModal({
  purchaseRecord,
  currentUserName = null,
}: RestockPurchaseRecordModalProps) {
  const {
    request,
    form,
    isSubmitting,
    problems,
    close,
    setStoreName,
    setPurchasedAt,
    setNotes,
    setBuyerName,
    toggleLine,
    setLineQuantity,
    setLinePrice,
    selectAll,
    submit,
    photoUploadRef,
  } = purchaseRecord;
  const baseId = useId();
  const storeNameRef = useRef<HTMLInputElement>(null);
  const isOpen = request !== null && form !== null;
  useReturnFocus(isOpen, storeNameRef);

  const hasBuyableLine =
    form?.lines.some((line) => line.remainingToBuy > 0) ?? false;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && close()}
      title="Catat Belanja"
      size="xl"
    >
      {request && form && (
        <form
          className="space-y-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Pengajuan {request.nomorRequest}. Catat satu toko sekali simpan.
            Kalau barangnya dibeli di beberapa toko, catat lagi untuk toko
            berikutnya.
          </p>

          <div className="space-y-1">
            <label htmlFor={`${baseId}-store`} className={LABEL_CLASS}>
              Nama toko
            </label>
            <input
              ref={storeNameRef}
              id={`${baseId}-store`}
              type="text"
              required
              maxLength={RESTOCK_PURCHASE_LIMITS.storeName}
              autoComplete="off"
              value={form.storeName}
              onChange={(event) => setStoreName(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`${baseId}-date`} className={LABEL_CLASS}>
              Tanggal belanja
            </label>
            <input
              id={`${baseId}-date`}
              type="date"
              required
              max={todayIsoDate()}
              value={form.purchasedAt}
              onChange={(event) => setPurchasedAt(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`${baseId}-buyer`} className={LABEL_CLASS}>
              Nama pembeli (boleh kosong)
            </label>
            <input
              id={`${baseId}-buyer`}
              type="text"
              maxLength={RESTOCK_PURCHASE_LIMITS.buyerName}
              autoComplete="name"
              placeholder={currentUserName ?? undefined}
              aria-describedby={`${baseId}-buyer-hint`}
              value={form.buyerName}
              onChange={(event) => setBuyerName(event.target.value)}
              className={FIELD_CLASS}
            />
            <p
              id={`${baseId}-buyer-hint`}
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              Kalau kosong, dicatat atas nama Anda.
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className={`${LABEL_CLASS} mb-2`}>
              Barang yang dibeli di toko ini
            </legend>
            {hasBuyableLine && (
              <button
                type="button"
                onClick={selectAll}
                className="min-h-[44px] rounded-2xl border border-indigo-300 bg-white px-4 py-2 text-sm font-bold text-indigo-800 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-gray-800 dark:text-indigo-200 dark:hover:bg-indigo-950/40"
              >
                Semua barang dibeli di toko ini
              </button>
            )}
            <ul className="space-y-3">
              {form.lines.map((line) => (
                <RestockPurchaseLineRow
                  key={line.purchaseOrderItemId}
                  line={line}
                  onToggle={(isChecked) =>
                    toggleLine(line.purchaseOrderItemId, isChecked)
                  }
                  onQuantityChange={(quantity) =>
                    setLineQuantity(line.purchaseOrderItemId, quantity)
                  }
                  onPriceChange={(unitPrice) =>
                    setLinePrice(line.purchaseOrderItemId, unitPrice)
                  }
                />
              ))}
            </ul>
          </fieldset>

          <section className="space-y-2">
            <p className={LABEL_CLASS}>Foto nota (tidak wajib)</p>
            <div className="rounded-3xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
              <PhotoUpload
                ref={photoUploadRef}
                maxPhotos={RESTOCK_PURCHASE_LIMITS.fotoNota}
                transactionType="inventory-masuk"
              />
            </div>
          </section>

          <div className="space-y-1">
            <label htmlFor={`${baseId}-notes`} className={LABEL_CLASS}>
              Catatan (tidak wajib)
            </label>
            <textarea
              id={`${baseId}-notes`}
              rows={2}
              maxLength={RESTOCK_PURCHASE_LIMITS.notes}
              value={form.notes}
              onChange={(event) => setNotes(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          {problems.length > 0 && !isSubmitting && (
            <div
              role="alert"
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
            >
              <p className="flex items-center gap-2 font-bold">
                <FiAlertTriangle aria-hidden="true" /> Belum bisa disimpan:
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-6">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={close}
              disabled={isSubmitting}
              className="min-h-[44px] flex-1 rounded-2xl bg-gray-100 px-4 py-3 font-bold text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              Batal
            </button>
            <button
              type="submit"
              aria-disabled={isSubmitting}
              className="flex min-h-[44px] flex-[2] items-center justify-center gap-2 rounded-2xl bg-indigo-700 px-4 py-3 font-bold text-white hover:bg-indigo-800 aria-disabled:opacity-50"
            >
              {isSubmitting ? (
                "Menyimpan..."
              ) : (
                <>
                  <FiCheck aria-hidden="true" /> Simpan Belanja
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
