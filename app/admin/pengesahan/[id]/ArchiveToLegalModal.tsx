"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, INPUT_CLASS } from "../../legal/components/form/form-fields";
import { isIndefiniteByDefault } from "../../legal/components/form/legal-form-state";
import { DOCUMENT_TYPE_LABEL } from "../../legal/components/legal-format";
import { jsonRequest, sendLegalRequest } from "../../legal/components/legal-request";
import { LEGAL_DOCUMENT_TYPES } from "../../legal/components/legal-types";
import { useLegalCategories } from "../../legal/components/useLegalCategories";

/** Simpan surat pengesahan yang sudah sah sebagai dokumen di arsip Legal. */

const MIN_TITLE_LENGTH = 3;

export default function ArchiveToLegalModal({
  endorsementId,
  defaultTitle,
  onClose,
}: {
  endorsementId: string;
  defaultTitle: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { categories } = useLegalCategories();
  const [title, setTitle] = useState(defaultTitle);
  const [documentType, setDocumentType] = useState<string>("KONTRAK");
  const [categoryId, setCategoryId] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const categoryOptions = categories.filter(
    (category) => category.documentType === documentType && category.isActive,
  );

  const changeType = (next: string) => {
    setDocumentType(next);
    setCategoryId("");
    if (!endDate) setIsIndefinite(isIndefiniteByDefault(next));
  };

  const submit = async () => {
    if (title.trim().length < MIN_TITLE_LENGTH) {
      toast.error(`Judul minimal ${MIN_TITLE_LENGTH} karakter`);
      return;
    }
    if (!isIndefinite && !endDate) {
      toast.error('Isi tanggal berakhir, atau centang "Berlaku tanpa batas waktu"');
      return;
    }

    setIsSaving(true);
    const saved = await sendLegalRequest<{ id: string }>(
      "/api/admin/legal/documents/from-endorsement",
      jsonRequest("POST", {
        endorsementId,
        title: title.trim(),
        documentType,
        categoryId: categoryId || null,
        endDate: isIndefinite ? null : endDate,
      }),
      "Gagal menyimpan ke arsip Legal",
    );
    setIsSaving(false);
    if (!saved) return;

    toast.success("Tersimpan di arsip Legal");
    router.push(`/admin/legal/dokumen/${saved.id}`);
  };

  return (
    <Modal isOpen onClose={onClose} title="Simpan ke arsip Legal">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          PDF yang sudah sah disimpan sebagai dokumen legal beserta masa berlakunya,
          sehingga pengingatnya ikut berjalan.
        </p>
        <FormField label="Judul">
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} className={INPUT_CLASS} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Jenis">
            <select value={documentType} onChange={(event) => changeType(event.target.value)} className={INPUT_CLASS}>
              {LEGAL_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DOCUMENT_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Kategori">
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={INPUT_CLASS}>
              <option value="">Tanpa kategori</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <FormField label="Berlaku sampai">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="date"
              value={isIndefinite ? "" : endDate}
              onChange={(event) => setEndDate(event.target.value)}
              disabled={isIndefinite}
              className={`${INPUT_CLASS} sm:max-w-xs`}
              aria-label="Tanggal berakhir"
            />
            <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={isIndefinite}
                onChange={(event) => setIsIndefinite(event.target.checked)}
                aria-label="Berlaku tanpa batas waktu"
              />
              Berlaku tanpa batas waktu
            </span>
          </div>
        </FormField>
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={isSaving}>
          Batal
        </Button>
        <Button onClick={submit} disabled={isSaving}>
          {isSaving ? "Menyimpan..." : "Simpan ke arsip Legal"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
