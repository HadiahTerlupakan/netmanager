"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, INPUT_CLASS } from "../components/form/form-fields";
import {
  DOCUMENT_TYPE_LABEL,
  MIN_CATEGORY_NAME_LENGTH,
} from "../components/legal-format";
import { jsonRequest, sendLegalRequest } from "../components/legal-request";
import { LEGAL_CATEGORIES_URL } from "../components/useLegalCategories";
import {
  LEGAL_DOCUMENT_TYPES,
  type LegalCategory,
} from "../components/legal-types";

/**
 * Tambah atau ubah satu kategori. Jenis dokumen hanya dipilih saat menambah —
 * kategori yang sudah dipakai dokumen tidak boleh berpindah jenis.
 */

const CONFIDENTIALITY_OPTIONS = [
  {
    value: "BIASA",
    title: "Biasa",
    description: "Terlihat oleh semua pengguna yang punya izin Legal.",
  },
  {
    value: "RAHASIA",
    title: "Rahasia",
    description: "Hanya terlihat oleh pengguna dengan izin Legal Rahasia (mis. akta, RUPS).",
  },
] as const;

export default function CategoryFormModal({
  category,
  onClose,
  onSaved,
}: {
  /** Kosong = tambah kategori baru. */
  category?: LegalCategory;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(category);
  const [name, setName] = useState(category?.name ?? "");
  const [documentType, setDocumentType] = useState<string>(
    category?.documentType ?? LEGAL_DOCUMENT_TYPES[0],
  );
  const [confidentiality, setConfidentiality] = useState<string>(
    category?.confidentiality ?? "BIASA",
  );
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < MIN_CATEGORY_NAME_LENGTH) {
      toast.error(`Nama kategori minimal ${MIN_CATEGORY_NAME_LENGTH} karakter`);
      return;
    }

    setIsSaving(true);
    const saved = await sendLegalRequest<LegalCategory>(
      isEdit ? `${LEGAL_CATEGORIES_URL}/${category!.id}` : LEGAL_CATEGORIES_URL,
      isEdit
        ? jsonRequest("PATCH", { name: trimmed, confidentiality })
        : jsonRequest("POST", { name: trimmed, documentType, confidentiality }),
      isEdit ? "Gagal menyimpan kategori" : "Gagal menambah kategori",
    );
    setIsSaving(false);
    if (!saved) return;

    toast.success(isEdit ? "Kategori disimpan" : "Kategori ditambahkan");
    onSaved();
  };

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? "Ubah kategori" : "Tambah kategori"}>
      <div className="space-y-4">
        <FormField label="Nama kategori">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={INPUT_CLASS}
            placeholder="mis. Izin Galian Kabupaten Bogor"
            autoFocus
          />
        </FormField>

        <FormField
          label="Jenis dokumen"
          hint={isEdit ? "Jenis tidak bisa diubah setelah kategori dibuat." : undefined}
        >
          <select
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            className={INPUT_CLASS}
            disabled={isEdit}
          >
            {LEGAL_DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {DOCUMENT_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        </FormField>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Kerahasiaan
          </legend>
          {CONFIDENTIALITY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                confidentiality === option.value
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <input
                type="radio"
                name="confidentiality"
                value={option.value}
                checked={confidentiality === option.value}
                onChange={() => setConfidentiality(option.value)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  {option.title}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={isSaving}>
          Batal
        </Button>
        <Button onClick={submit} disabled={isSaving}>
          {isSaving ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah kategori"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
