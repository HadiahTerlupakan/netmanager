"use client";

import { type KeyboardEvent, useEffect, useId, useRef } from "react";

import {
  PURCHASE_VOID_REASON_MAX,
  useRestockPurchaseVoid,
} from "./useRestockPurchaseVoid";

interface RestockPurchaseVoidControlProps {
  requestId: string;
  recordId: string;
  /** Mis. "belanja ke-2" (catatan lama: "belanja ke-2 di Toko Sinar"). */
  recordLabel: string;
  onVoided: () => Promise<void> | void;
}

const TRIGGER_CLASS =
  "min-h-[44px] text-left text-sm font-semibold text-red-800 underline underline-offset-2 hover:text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300 sm:min-h-0";
const DANGER_BUTTON_CLASS =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 aria-disabled:opacity-50 dark:focus-visible:ring-offset-gray-900";
const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-900";

/**
 * Tombol "Batalkan catatan belanja" di riwayat, dengan konfirmasi dan alasan
 * wajib di tempat (bukan jendela konfirmasi peramban).
 */
export function RestockPurchaseVoidControl({
  requestId,
  recordId,
  recordLabel,
  onVoided,
}: RestockPurchaseVoidControlProps) {
  const state = useRestockPurchaseVoid({ requestId, recordId, onVoided });
  const reasonId = useId();
  const hintId = useId();
  const errorId = useId();
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  // Buka: fokus ke isian alasan. Tutup (batal maupun berhasil): fokus kembali
  // ke tombol pemicu, supaya posisi pengguna keyboard di jendela tidak hilang.
  useEffect(() => {
    if (state.isOpen) reasonRef.current?.focus();
    else if (wasOpenRef.current) triggerRef.current?.focus();
    wasOpenRef.current = state.isOpen;
  }, [state.isOpen]);

  // Escape menutup panel ini saja, bukan seluruh jendela detail beserta
  // alasan yang sudah diketik.
  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    event.preventDefault();
    if (!state.isBusy) state.close();
  }

  if (!state.isOpen) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={state.open}
        aria-label={`Batalkan catatan ${recordLabel}`}
        className={TRIGGER_CLASS}
      >
        Batalkan catatan belanja
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Batalkan catatan ${recordLabel}`}
      onKeyDown={closeOnEscape}
      className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30"
    >
      <p className="text-sm font-bold text-red-900 dark:text-red-100">
        Batalkan catatan {recordLabel}?
      </p>
      <p id={hintId} className="text-sm text-red-900 dark:text-red-100">
        Barang di catatan ini kembali dihitung belum dibeli. Catatannya tetap
        terlihat di riwayat dengan tanda dibatalkan.
      </p>
      <div className="space-y-1">
        <label
          htmlFor={reasonId}
          className="text-sm font-bold text-gray-900 dark:text-white"
        >
          Alasan pembatalan
        </label>
        <textarea
          ref={reasonRef}
          id={reasonId}
          value={state.reason}
          maxLength={PURCHASE_VOID_REASON_MAX}
          rows={2}
          aria-describedby={
            state.errorMessage ? `${hintId} ${errorId}` : hintId
          }
          aria-invalid={state.errorMessage ? true : undefined}
          onChange={(event) => state.setReason(event.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-red-900"
        />
      </div>
      {state.errorMessage && (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-red-800 dark:text-red-200"
        >
          {state.errorMessage}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-disabled={state.isBusy}
          onClick={() => !state.isBusy && void state.submit()}
          className={DANGER_BUTTON_CLASS}
        >
          {state.isBusy ? "Membatalkan…" : "Ya, batalkan catatan"}
        </button>
        <button
          type="button"
          onClick={state.close}
          className={SECONDARY_BUTTON_CLASS}
        >
          Jangan dibatalkan
        </button>
      </div>
    </div>
  );
}
