"use client";

import { useState } from "react";
import { HiOutlineEnvelope } from "react-icons/hi2";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const RESOLUTION_MAX_LENGTH = 2000;

interface CloseTicketModalProps {
  open: boolean;
  closing: boolean;
  onCancel: () => void;
  onConfirm: (resolution: string) => Promise<void> | void;
}

export function CloseTicketModal({
  open,
  closing,
  onCancel,
  onConfirm,
}: CloseTicketModalProps) {
  const [resolution, setResolution] = useState("");

  const handleCancel = () => {
    setResolution("");
    onCancel();
  };

  const handleConfirm = async () => {
    await Promise.resolve(onConfirm(resolution));
    setResolution("");
  };

  return (
    <Modal isOpen={open} onClose={handleCancel} title="Tutup Tiket?" size="md">
      <div className="flex items-center gap-3 mb-4 text-amber-600">
        <HiOutlineEnvelope className="w-8 h-8" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Setelah ditutup, pelanggan tidak dapat membalas lagi. Pastikan masalah
          sudah terselesaikan.
        </p>
      </div>
      <textarea
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
        placeholder="Catatan penutup (opsional)..."
        rows={3}
        maxLength={RESOLUTION_MAX_LENGTH}
        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4"
      />
      <ModalFooter>
        <Button variant="outline" onClick={handleCancel} className="flex-1">
          Batal
        </Button>
        <Button
          variant="destructive"
          onClick={handleConfirm}
          disabled={closing}
          className="flex-1"
        >
          {closing ? "Menutup..." : "Tutup Tiket"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
