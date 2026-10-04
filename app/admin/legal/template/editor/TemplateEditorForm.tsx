"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { HiOutlineDocumentPlus } from "react-icons/hi2";
import { Button, buttonVariants } from "@/components/ui/Button";
import CategorySelect from "../../components/form/CategorySelect";
import { FormField, INPUT_CLASS } from "../../components/form/form-fields";
import { DOCUMENT_TYPE_LABEL } from "../../components/legal-format";
import {
  HTTP_CONFLICT,
  jsonRequest,
  requestLegalApi,
} from "../../components/legal-request";
import {
  LEGAL_DOCUMENT_TYPES,
  type LegalTemplate,
  type TemplateBlock,
  type TemplatePlaceholder,
} from "../../components/legal-types";
import TemplatePageHeader from "../TemplatePageHeader";
import { LEGAL_TEMPLATES_URL, TEMPLATE_LIST_PATH, templateUsePath } from "../useLegalTemplates";
import BlockEditor from "./BlockEditor";
import EditorCard, { WORKSPACE_GRID_CLASS } from "./EditorCard";
import PreviewPanel from "./PreviewPanel";
import {
  createBlock,
  MAX_TEMPLATE_NAME_LENGTH,
  MIN_TEMPLATE_NAME_LENGTH,
  prepareTemplateContent,
} from "./template-blocks";
import { useTemplatePreview } from "./useTemplatePreview";

/**
 * Formulir template: nama, jenis (hanya saat baru), kategori, editor blok,
 * dan pratinjau PDF. Nama ganda (409) ditampilkan langsung di bawah isian nama.
 */

const NEW_TEMPLATE_BLOCKS: TemplateBlock[] = [createBlock("heading"), createBlock("paragraph")];

export default function TemplateEditorForm({
  template,
  placeholders,
  onSaved,
}: {
  /** Kosong = template baru. */
  template?: LegalTemplate;
  placeholders: TemplatePlaceholder[];
  onSaved: (saved: LegalTemplate) => void;
}) {
  const isEdit = Boolean(template);
  const initialBlocks = template?.content ?? NEW_TEMPLATE_BLOCKS;
  const [name, setName] = useState(template?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<string>(
    template?.documentType ?? LEGAL_DOCUMENT_TYPES[0],
  );
  const [categoryId, setCategoryId] = useState(template?.category?.id ?? "");
  const [blocks, setBlocks] = useState<TemplateBlock[]>(initialBlocks);
  const [isSaving, setIsSaving] = useState(false);
  const preview = useTemplatePreview();
  const { refreshPreview } = preview;

  useEffect(() => {
    void refreshPreview(initialBlocks);
  }, [initialBlocks, refreshPreview]);

  const save = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < MIN_TEMPLATE_NAME_LENGTH) {
      setNameError(`Nama template minimal ${MIN_TEMPLATE_NAME_LENGTH} karakter`);
      return;
    }
    const prepared = prepareTemplateContent(blocks);
    if (prepared.error !== null) {
      toast.error(prepared.error);
      return;
    }

    const fields = { name: trimmedName, categoryId: categoryId || null, content: prepared.content };
    setIsSaving(true);
    const result = await requestLegalApi<LegalTemplate>(
      template ? `${LEGAL_TEMPLATES_URL}/${template.id}` : LEGAL_TEMPLATES_URL,
      template ? jsonRequest("PATCH", fields) : jsonRequest("POST", { ...fields, documentType }),
      "Gagal menyimpan template",
    );
    setIsSaving(false);

    if (result.kind === "failure") {
      if (result.status === HTTP_CONFLICT) setNameError(result.message);
      toast.error(result.message);
      return;
    }
    toast.success(isEdit ? "Template disimpan" : "Template ditambahkan");
    onSaved(result.data);
  };

  return (
    <div className="space-y-6">
      <TemplatePageHeader
        backHref={TEMPLATE_LIST_PATH}
        backLabel="Template dokumen"
        title={isEdit ? "Ubah template" : "Tambah template"}
        actions={
          <>
            {template?.isActive && (
              <Link
                href={templateUsePath(template.id)}
                className={buttonVariants({ variant: "outline" })}
              >
                <HiOutlineDocumentPlus />
                Pakai template
              </Link>
            )}
            <Button variant="primary" onClick={() => void save()} loading={isSaving}>
              {isEdit ? "Simpan perubahan" : "Simpan template"}
            </Button>
          </>
        }
      />

      <div className={WORKSPACE_GRID_CLASS}>
        <div className="space-y-6">
          <EditorCard title="Informasi template">
            <div>
              <FormField label="Nama template">
                <input
                  type="text"
                  value={name}
                  maxLength={MAX_TEMPLATE_NAME_LENGTH}
                  onChange={(event) => {
                    setName(event.target.value);
                    setNameError(null);
                  }}
                  className={INPUT_CLASS}
                  placeholder="mis. PKS Reseller Area Bogor"
                  aria-invalid={Boolean(nameError)}
                />
              </FormField>
              {nameError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{nameError}</p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                label="Jenis dokumen"
                hint={isEdit ? "Jenis tidak bisa diubah setelah template dibuat." : undefined}
              >
                <select
                  value={documentType}
                  onChange={(event) => {
                    setDocumentType(event.target.value);
                    setCategoryId("");
                  }}
                  disabled={isEdit}
                  className={INPUT_CLASS}
                >
                  {LEGAL_DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {DOCUMENT_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Kategori (opsional)">
                <CategorySelect
                  documentType={documentType}
                  value={categoryId}
                  onChange={setCategoryId}
                />
              </FormField>
            </div>
          </EditorCard>

          <EditorCard title="Isi template">
            <BlockEditor blocks={blocks} onBlocksChange={setBlocks} placeholders={placeholders} />
          </EditorCard>
        </div>

        <PreviewPanel
          previewUrl={preview.previewUrl}
          isLoading={preview.isLoading}
          error={preview.error}
          onRefresh={() => void refreshPreview(blocks)}
        />
      </div>
    </div>
  );
}
