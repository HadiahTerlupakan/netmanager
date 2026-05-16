import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";

interface RejectModalProps {
  isOpen: boolean;
  rejectReason: string;
  rejectError: string | null;
  processingId: string | null;
  rejectId: string | null;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function RejectModal({
  isOpen,
  rejectReason,
  rejectError,
  processingId,
  rejectId,
  onReasonChange,
  onClose,
  onSubmit,
}: RejectModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tolak Lembur" size="md">
      <div>
        <label className="block text-sm font-medium mb-2 dark:text-gray-300">
          Alasan Penolakan
        </label>
        <textarea
          className={`w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white ${rejectError ? "border-red-500" : ""}`}
          rows={4}
          maxLength={500}
          value={rejectReason}
          onChange={(e) => onReasonChange(e.target.value)}
        />
        {rejectError && (
          <p className="text-xs text-red-500 mb-2">{rejectError}</p>
        )}
        <p className="text-xs text-gray-500 mb-3">
          {rejectReason.length}/500 karakter
        </p>
      </div>
      <ModalFooter>
        <Button onClick={onClose} variant="outline" size="sm">
          Batal
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!rejectReason.trim() || processingId === rejectId}
          variant="destructive"
          size="sm"
        >
          Tolak
        </Button>
      </ModalFooter>
    </Modal>
  );
}
