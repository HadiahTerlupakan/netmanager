"use client";

import { Modal, ModalFooter } from "@/components/ui/Modal";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  variant: "danger" | "warning" | "primary";
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  variant,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  const confirmClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700"
      : variant === "warning"
        ? "bg-orange-500 hover:bg-orange-600"
        : "bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="py-2">
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
      <ModalFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Batal
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 text-white rounded-lg transition-colors ${confirmClass}`}
        >
          Konfirmasi
        </button>
      </ModalFooter>
    </Modal>
  );
}
