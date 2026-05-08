import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";

interface EditFormData {
  reason: string;
  startTime: string;
  endTime: string;
}

interface EditModalProps {
  isOpen: boolean;
  editForm: EditFormData;
  editErrors: Record<string, string>;
  processingId: string | null;
  editId: string | null;
  onFormChange: (form: EditFormData) => void;
  onErrorChange: (errors: Record<string, string>) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function EditModal({
  isOpen,
  editForm,
  editErrors,
  processingId,
  editId,
  onFormChange,
  onErrorChange,
  onClose,
  onSubmit,
}: EditModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Data Lembur" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">
            Alasan Lembur
          </label>
          <textarea
            className={`w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white ${editErrors.reason ? "border-red-500" : ""}`}
            rows={3}
            value={editForm.reason}
            onChange={(e) => {
              onFormChange({ ...editForm, reason: e.target.value });
              if (editErrors.reason) {
                onErrorChange({ ...editErrors, reason: "" });
              }
            }}
          />
          {editErrors.reason && (
            <p className="text-xs text-red-500 mt-1">{editErrors.reason}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {editForm.reason.length}/500 karakter (min 10)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">
              Jam Mulai
            </label>
            <input
              type="datetime-local"
              className="w-full p-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              value={editForm.startTime}
              onChange={(e) =>
                onFormChange({ ...editForm, startTime: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">
              Jam Selesai
            </label>
            <input
              type="datetime-local"
              className="w-full p-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              value={editForm.endTime}
              onChange={(e) =>
                onFormChange({ ...editForm, endTime: e.target.value })
              }
            />
          </div>
        </div>
        {editErrors.time && (
          <p className="text-xs text-red-500">{editErrors.time}</p>
        )}
      </div>
      <ModalFooter>
        <Button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Batal
        </Button>
        <Button onClick={onSubmit} disabled={processingId === editId}>
          Simpan Perubahan
        </Button>
      </ModalFooter>
    </Modal>
  );
}
