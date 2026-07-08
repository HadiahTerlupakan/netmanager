"use client";

import { Modal, ModalFooter } from "@/components/ui/Modal";
import { HiOutlineTrash } from "react-icons/hi2";

export interface MitraDeleteModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly deleting: boolean;
  readonly onDelete: () => void;
}

export function MitraDeleteModal({
  isOpen,
  onClose,
  deleting,
  onDelete,
}: MitraDeleteModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nonaktifkan Mitra?"
      size="md"
    >
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <HiOutlineTrash className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Mitra ini akan dinonaktifkan dan tidak bisa login. Data tidak dihapus
          permanen.
        </p>
      </div>
      <ModalFooter>
        <button
          onClick={onClose}
          disabled={deleting}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Batal
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {deleting ? "Memproses..." : "Ya, Nonaktifkan"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
