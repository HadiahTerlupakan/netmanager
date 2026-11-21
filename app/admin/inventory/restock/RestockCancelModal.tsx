"use client";

import { useEffect, useId, useRef } from "react";
import { FiAlertCircle, FiInfo } from "react-icons/fi";

import { Modal } from "@/components/ui/Modal";
import { RESTOCK_CANCEL_REASON_LIMITS } from "@/lib/validations/restock";

import { RestockProblemList } from "./RestockProblemList";
import {
  CANCEL_REQUEST_LABEL,
  getRestockCancelProblem,
  getRestockCancelReasonLength,
} from "./restockCancel";
import {
  getFocusedElement,
  getRestockFocusKey,
  restoreRestockFocus,
} from "./restockFocus";
import type { PurchaseRequest } from "./types";
import type { RestockCancelState } from "./useRestockCancel";

interface RestockCancelModalProps {
  state: RestockCancelState;
}

interface RestockCancelDialogProps extends RestockCancelModalProps {
  request: PurchaseRequest;
}

const CANCEL_CONSEQUENCE_NOTE =
  "Setelah dibatalkan, barang dan jasa di pengajuan ini tidak diproses lagi. Kalau masih dibutuhkan, buat pengajuan baru.";

/**
 * Modal bersama tidak mengatur fokus. Saat dialog terbuka fokus pindah ke
 * kolom alasan. Saat tertutup fokus kembali ke tombol yang membukanya; bila
 * tombol itu sudah diganti karena daftar dimuat ulang (atau hilang karena
 * pengajuannya sudah dibatalkan), ke tombol Batalkan lalu tombol Detail
 * pengajuan yang sama di tabel.
 */
function useDialogFocus<T extends HTMLElement>(requestId: string) {
  const initialFocusRef = useRef<T>(null);

  useEffect(() => {
    const trigger = getFocusedElement();
    initialFocusRef.current?.focus();
    return () =>
      restoreRestockFocus({
        trigger,
        fallbackKeys: [
          getRestockFocusKey("cancel", requestId),
          getRestockFocusKey("detail", requestId),
        ],
      });
  }, [requestId]);

  return initialFocusRef;
}

/** Penolakan dari server difokus begitu muncul, supaya langsung terbaca. */
function useFocusOnError<T extends HTMLElement>(errorMessage: string | null) {
  const errorRef = useRef<T>(null);

  useEffect(() => {
    if (errorMessage) errorRef.current?.focus();
  }, [errorMessage]);

  return errorRef;
}

function RestockCancelDialog({ state, request }: RestockCancelDialogProps) {
  const reasonId = useId();
  const hintId = useId();
  const problemId = useId();
  const errorId = useId();
  const reasonRef = useDialogFocus<HTMLTextAreaElement>(request.id);
  const errorRef = useFocusOnError<HTMLDivElement>(state.errorMessage);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const problem = getRestockCancelProblem(state.reason);
  const isProblemShown = problem !== null && !state.isSubmitting;
  const isSubmitDisabled = state.isSubmitting || problem !== null;
  const submitDescriptionIds = [
    isProblemShown ? problemId : null,
    state.errorMessage ? errorId : null,
  ].filter(Boolean);

  const handleClose = () => {
    if (!state.isSubmitting) state.close();
  };

  // Fokus dipegang tombol ini selama menyimpan (aria-disabled, bukan
  // disabled), karena kolom alasan ikut terkunci dan fokus di sana akan
  // jatuh ke body.
  const handleSubmitClick = () => {
    if (isSubmitDisabled) return;
    submitButtonRef.current?.focus();
    void state.submit();
  };

  return (
    <Modal isOpen onClose={handleClose} title={CANCEL_REQUEST_LABEL}>
      <div className="space-y-5 p-4 sm:p-6">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Pengajuan {request.nomorRequest}
        </p>

        <p className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">
          <FiInfo aria-hidden="true" className="mt-0.5 shrink-0" />
          {CANCEL_CONSEQUENCE_NOTE}
        </p>

        <div className="space-y-2">
          <label
            htmlFor={reasonId}
            className="block text-sm font-bold text-gray-800 dark:text-gray-100"
          >
            Alasan pembatalan (wajib)
          </label>
          <textarea
            id={reasonId}
            ref={reasonRef}
            rows={3}
            maxLength={RESTOCK_CANCEL_REASON_LIMITS.max}
            value={state.reason}
            disabled={state.isSubmitting}
            onChange={(event) => state.setReason(event.target.value)}
            aria-describedby={
              isProblemShown ? `${hintId} ${problemId}` : hintId
            }
            aria-invalid={state.reason.length > 0 && problem !== null}
            placeholder="Contoh: barangnya sudah tidak dibutuhkan"
            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-red-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          <p id={hintId} className="text-xs text-gray-600 dark:text-gray-400">
            Paling sedikit {RESTOCK_CANCEL_REASON_LIMITS.min} huruf; spasi di
            awal dan akhir tidak dihitung. Terisi{" "}
            {getRestockCancelReasonLength(state.reason)}/
            {RESTOCK_CANCEL_REASON_LIMITS.max}.
          </p>
        </div>

        {isProblemShown && (
          <RestockProblemList
            id={problemId}
            title="Belum bisa dibatalkan:"
            problems={[problem]}
          />
        )}

        {state.errorMessage && (
          <div
            id={errorId}
            ref={errorRef}
            tabIndex={-1}
            className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100"
          >
            <FiAlertCircle aria-hidden="true" className="mt-0.5 shrink-0" />
            <p>{state.errorMessage}</p>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleClose}
            disabled={state.isSubmitting}
            className="min-h-[44px] flex-1 rounded-2xl bg-gray-100 px-4 py-3 font-bold text-gray-800 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100"
          >
            Kembali
          </button>
          <button
            ref={submitButtonRef}
            type="button"
            onClick={handleSubmitClick}
            disabled={problem !== null}
            aria-disabled={isSubmitDisabled}
            aria-describedby={submitDescriptionIds.join(" ") || undefined}
            className="min-h-[44px] flex-[2] rounded-2xl bg-red-700 px-4 py-3 font-bold text-white hover:bg-red-800 disabled:opacity-50 aria-disabled:opacity-50"
          >
            {state.isSubmitting ? "Membatalkan..." : "Ya, Batalkan Pengajuan"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Modal "Batalkan Pengajuan": alasan wajib dan akibatnya sebelum disimpan.
 * Tidak bisa ditutup selama sedang menyimpan.
 */
export function RestockCancelModal({ state }: RestockCancelModalProps) {
  if (!state.request) return null;
  return <RestockCancelDialog state={state} request={state.request} />;
}
