"use client";

import { Modal, ModalBody, ModalFooter } from "@/components/ui/Modal";
import type { RABRevisionRecord } from "./rabRevisionTypes";

interface RABRejectRevisionModalProps {
  isOpen: boolean;
  notes: string;
  rejectingRevision: RABRevisionRecord | null;
  isSubmitting: boolean;
  onChangeNotes: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

/** Menampilkan modal penolakan revisi RAB beserta catatan reviewer. */
export default function RABRejectRevisionModal({
  isOpen,
  notes,
  rejectingRevision,
  isSubmitting,
  onChangeNotes,
  onClose,
  onConfirm,
}: RABRejectRevisionModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tolak Revisi"
      description={
        rejectingRevision
          ? `Revisi ${rejectingRevision.revisionNumber}`
          : undefined
      }
      size="lg"
    >
      <ModalBody>
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Tambahkan catatan agar pembuat revisi tahu apa yang harus diperbaiki
            sebelum mengajukan ulang.
          </p>
          <textarea
            value={notes}
            onChange={(event) => onChangeNotes(event.target.value)}
            placeholder="Contoh: harga satuan item backbone belum pakai penawaran vendor terbaru"
            className="min-h-[120px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </ModalBody>
      <ModalFooter className="justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Catatan penolakan bersifat opsional, namun disarankan diisi.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"
          >
            {isSubmitting ? "Memproses..." : "Tolak Revisi"}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
