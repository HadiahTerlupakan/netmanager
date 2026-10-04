"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS } from "../../components/form/form-fields";
import { jsonRequest, sendLegalRequest } from "../../components/legal-request";

/** Pengakhiran dokumen sebelum masa berlakunya habis, wajib dengan alasan. */

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 500;

export default function TerminateDocumentModal({
  documentId,
  onClose,
  onTerminated,
}: {
  documentId: string;
  onClose: () => void;
  onTerminated: () => void;
}) {
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
      toast.error("Tuliskan alasan pengakhiran");
      return;
    }

    setIsSaving(true);
    const result = await sendLegalRequest<{ terminated: boolean }>(
      `/api/admin/legal/documents/${documentId}/terminate`,
      jsonRequest("POST", { reason: trimmed }),
      "Gagal mengakhiri dokumen",
    );
    setIsSaving(false);
    if (!result) return;

    toast.success("Dokumen diakhiri");
    onTerminated();
  };

  return (
    <Modal isOpen onClose={onClose} title="Akhiri dokumen">
      <div className="space-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Dokumen yang diakhiri tidak lagi dipantau dan tidak bisa diubah.
        </p>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={MAX_REASON_LENGTH}
          className={INPUT_CLASS}
          placeholder="Alasan pengakhiran, mis. lokasi tower dipindah"
          aria-label="Alasan pengakhiran"
        />
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={isSaving}>
          Batal
        </Button>
        <Button variant="destructive" onClick={submit} disabled={isSaving}>
          {isSaving ? "Menyimpan..." : "Akhiri dokumen"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
