"use client";

import { FiInfo } from "react-icons/fi";

import { Modal } from "@/components/ui/Modal";

import { RestockNotComingReasonSelect } from "./RestockNotComingReasonSelect";
import {
  CLOSE_UNPURCHASED_TITLE,
  describeRestockUnpurchasedLine,
  getCloseUnpurchasedNote,
  getCloseUnpurchasedSubmitLabel,
  getRestockUnpurchasedLines,
  predictCloseUnpurchasedOutcome,
} from "./restockCloseUnpurchased";
import type { RestockCloseUnpurchasedState } from "./useRestockCloseUnpurchased";

interface RestockCloseUnpurchasedModalProps {
  state: RestockCloseUnpurchasedState;
}

/**
 * Modal "Tutup sisa yang tidak jadi dibeli": daftar barang yang belum dibeli,
 * alasan wajib, dan akibatnya bagi pengajuan sebelum disimpan.
 */
export function RestockCloseUnpurchasedModal({
  state,
}: RestockCloseUnpurchasedModalProps) {
  const { request } = state;
  if (!request) return null;

  const lines = getRestockUnpurchasedLines(request);
  const outcome = predictCloseUnpurchasedOutcome(request);
  const isReasonMissing = state.reason.trim().length === 0;
  const isSubmitDisabled = state.isSubmitting || isReasonMissing;

  const handleClose = () => {
    if (!state.isSubmitting) state.close();
  };

  return (
    <Modal isOpen onClose={handleClose} title={CLOSE_UNPURCHASED_TITLE}>
      <div className="space-y-5 p-4 sm:p-6">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Pengajuan {request.nomorRequest}
        </p>

        <section aria-label="Barang yang belum dibeli" className="space-y-2">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Barang yang akan ditutup
          </h3>
          <ul className="space-y-1 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            {lines.map((line) => (
              <li key={line.barangId}>
                {describeRestockUnpurchasedLine(line)}
              </li>
            ))}
          </ul>
        </section>

        <RestockNotComingReasonSelect
          question="Kenapa tidak jadi dibeli"
          reason={state.reason}
          onReasonChange={state.setReason}
        />

        <p className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">
          <FiInfo aria-hidden="true" className="mt-0.5 shrink-0" />
          {getCloseUnpurchasedNote(outcome, request)}
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleClose}
            disabled={state.isSubmitting}
            className="min-h-[44px] flex-1 rounded-2xl bg-gray-100 px-4 py-3 font-bold text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100"
          >
            Kembali
          </button>
          <button
            type="button"
            onClick={() => void state.submit()}
            disabled={isSubmitDisabled}
            className="min-h-[44px] flex-[2] rounded-2xl bg-orange-700 px-4 py-3 font-bold text-white hover:bg-orange-800 disabled:opacity-50"
          >
            {state.isSubmitting
              ? "Menyimpan..."
              : getCloseUnpurchasedSubmitLabel(outcome)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
