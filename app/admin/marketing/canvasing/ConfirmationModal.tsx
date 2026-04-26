import { Button } from "@/components/ui/Button";

interface ConfirmationModalState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  processing: boolean;
}

interface ConfirmationModalProps {
  modal: ConfirmationModalState;
  onConfirm: () => void;
  onClose: () => void;
}

const CONFIRMATION_MODAL_TITLE_ID = "canvasing-confirmation-modal-title";

/** Render a reusable confirmation dialog for destructive canvasing actions. */
export default function ConfirmationModal({
  modal,
  onConfirm,
  onClose,
}: ConfirmationModalProps) {
  if (!modal.open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={CONFIRMATION_MODAL_TITLE_ID}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
      >
        <h3
          id={CONFIRMATION_MODAL_TITLE_ID}
          className="text-lg font-bold text-gray-900 dark:text-white"
        >
          {modal.title}
        </h3>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          {modal.message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={modal.processing}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={modal.processing}
          >
            {modal.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export type { ConfirmationModalState };
