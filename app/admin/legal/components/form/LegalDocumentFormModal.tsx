"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { jsonRequest, sendLegalRequest } from "../legal-request";
import type { LegalDocumentDetail } from "../legal-types";
import {
  buildLegalPayload,
  createEmptyFormValues,
  formValuesFromDetail,
  validateLegalForm,
  type LegalFormMode,
  type LegalFormValues,
} from "./legal-form-state";
import type { UpdateLegalField } from "./form-fields";
import RequiredFields from "./RequiredFields";
import DetailFields from "./DetailFields";
import LegalAttributeFields from "./LegalAttributeFields";
import ObligationRows from "./ObligationRows";

/**
 * Formulir dokumen legal untuk tiga mode: tambah, ubah, dan perpanjang.
 * Hanya judul, jenis, dan berkas yang wajib; sisanya di seksi lipat.
 */

const MODE_COPY: Record<
  LegalFormMode,
  { title: string; submit: string; success: string; failure: string }
> = {
  create: {
    title: "Tambah dokumen legal",
    submit: "Simpan dokumen",
    success: "Dokumen legal disimpan",
    failure: "Gagal menyimpan dokumen",
  },
  edit: {
    title: "Ubah dokumen legal",
    submit: "Simpan perubahan",
    success: "Perubahan disimpan",
    failure: "Gagal menyimpan perubahan",
  },
  renew: {
    title: "Perpanjang dokumen legal",
    submit: "Perpanjang",
    success: "Dokumen diperpanjang",
    failure: "Gagal memperpanjang dokumen",
  },
};

/** Alamat & opsi fetch sesuai mode; tambah/perpanjang memakai multipart. */
function buildSubmitRequest(
  mode: LegalFormMode,
  payload: Record<string, unknown>,
  file: File | null,
  documentId?: string,
): { url: string; init: RequestInit } {
  if (mode === "edit") {
    return {
      url: `/api/admin/legal/documents/${documentId}`,
      init: jsonRequest("PATCH", payload),
    };
  }

  const formData = new FormData();
  if (file) formData.append("file", file);
  formData.append("payload", JSON.stringify(payload));
  const url =
    mode === "renew"
      ? `/api/admin/legal/documents/${documentId}/renew`
      : "/api/admin/legal/documents";

  return { url, init: { method: "POST", body: formData } };
}

export default function LegalDocumentFormModal({
  mode,
  document,
  onClose,
  onSaved,
}: {
  mode: LegalFormMode;
  /** Wajib untuk mode ubah & perpanjang. */
  document?: LegalDocumentDetail;
  onClose: () => void;
  /** Menerima detail hasil simpan (dokumen BARU pada perpanjangan). */
  onSaved: (saved: LegalDocumentDetail) => void;
}) {
  const [values, setValues] = useState<LegalFormValues>(() =>
    document ? formValuesFromDetail(document, mode) : createEmptyFormValues(),
  );
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const copy = MODE_COPY[mode];

  const updateField: UpdateLegalField = (key, value) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const validationError = validateLegalForm(values, mode, file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const { url, init } = buildSubmitRequest(
      mode,
      buildLegalPayload(values, mode),
      file,
      document?.id,
    );
    setIsSaving(true);
    const saved = await sendLegalRequest<LegalDocumentDetail>(
      url,
      init,
      copy.failure,
    );
    setIsSaving(false);
    if (!saved) return;

    toast.success(copy.success);
    onSaved(saved);
  };

  return (
    <Modal isOpen onClose={onClose} title={copy.title} size="2xl">
      <div className="space-y-4">
        <RequiredFields
          mode={mode}
          values={values}
          onChange={updateField}
          onFileChange={setFile}
        />
        <DetailFields values={values} onChange={updateField} />
        <LegalAttributeFields values={values} onChange={updateField} />
        <ObligationRows
          obligations={values.obligations}
          onChange={(next) => updateField("obligations", next)}
        />
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={isSaving}>
          Batal
        </Button>
        <Button onClick={submit} disabled={isSaving}>
          {isSaving ? "Menyimpan..." : copy.submit}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
