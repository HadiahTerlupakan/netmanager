"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS } from "../components/form/form-fields";
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

/** Formulir satu baris untuk menambah kategori baru. */
export default function CategoryAddForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [documentType, setDocumentType] = useState<string>(LEGAL_DOCUMENT_TYPES[0]);
  const [isConfidential, setIsConfidential] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < MIN_CATEGORY_NAME_LENGTH) {
      toast.error(`Nama kategori minimal ${MIN_CATEGORY_NAME_LENGTH} karakter`);
      return;
    }

    setIsSaving(true);
    const created = await sendLegalRequest<LegalCategory>(
      LEGAL_CATEGORIES_URL,
      jsonRequest("POST", {
        name: trimmed,
        documentType,
        confidentiality: isConfidential ? "RAHASIA" : "BIASA",
      }),
      "Gagal menambah kategori",
    );
    setIsSaving(false);
    if (!created) return;

    toast.success("Kategori ditambahkan");
    setName("");
    setIsConfidential(false);
    onCreated();
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center dark:border-gray-700 dark:bg-gray-800">
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className={`${INPUT_CLASS} sm:flex-1`}
        placeholder="Nama kategori baru"
        aria-label="Nama kategori baru"
      />
      <select
        value={documentType}
        onChange={(event) => setDocumentType(event.target.value)}
        className={`${INPUT_CLASS} sm:w-40`}
        aria-label="Jenis dokumen"
      >
        {LEGAL_DOCUMENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {DOCUMENT_TYPE_LABEL[type]}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={isConfidential}
          onChange={(event) => setIsConfidential(event.target.checked)}
        />
        Rahasia
      </label>
      <Button onClick={submit} disabled={isSaving}>
        {isSaving ? "Menyimpan..." : "Tambah"}
      </Button>
    </div>
  );
}
