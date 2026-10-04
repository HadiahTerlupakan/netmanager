"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import DetailFields from "../../../components/form/DetailFields";
import { CollapsibleSection, type UpdateLegalField } from "../../../components/form/form-fields";
import LegalAttributeFields from "../../../components/form/LegalAttributeFields";
import {
  validateGeneratedDocumentForm,
  type LegalFormValues,
} from "../../../components/form/legal-form-state";
import ObligationRows from "../../../components/form/ObligationRows";
import RequiredFields from "../../../components/form/RequiredFields";
import { jsonRequest, requestLegalApi } from "../../../components/legal-request";
import type {
  LegalDocumentDetail,
  LegalTemplate,
  TemplateBlock,
  TemplatePlaceholder,
} from "../../../components/legal-types";
import BlockEditor from "../../editor/BlockEditor";
import EditorCard, { WORKSPACE_GRID_CLASS } from "../../editor/EditorCard";
import PreviewPanel from "../../editor/PreviewPanel";
import { prepareTemplateContent } from "../../editor/template-blocks";
import { useTemplatePreview } from "../../editor/useTemplatePreview";
import TemplatePageHeader from "../../TemplatePageHeader";
import { DOCUMENT_FROM_TEMPLATE_URL, TEMPLATE_LIST_PATH } from "../../useLegalTemplates";
import {
  buildPreviewDocument,
  buildTemplateDocumentPayload,
  formValuesFromTemplate,
} from "./template-document-state";

/**
 * Data dokumen + isi (boleh disesuaikan tanpa mengubah template) + pratinjau
 * PDF, lalu disimpan sebagai dokumen legal dan diarahkan ke detailnya agar
 * bisa langsung dikirim untuk ditandatangani.
 */
export default function TemplateDocumentForm({
  template,
  placeholders,
}: {
  template: LegalTemplate;
  placeholders: TemplatePlaceholder[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<LegalFormValues>(() => formValuesFromTemplate(template));
  const [blocks, setBlocks] = useState<TemplateBlock[]>(template.content);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const preview = useTemplatePreview();
  const { refreshPreview } = preview;

  useEffect(() => {
    void refreshPreview(template.content, buildPreviewDocument(formValuesFromTemplate(template)));
  }, [template, refreshPreview]);

  const updateField: UpdateLegalField = (key, value) =>
    setValues((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const validationError = validateGeneratedDocumentForm(values);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    const prepared = prepareTemplateContent(blocks);
    if (prepared.error !== null) {
      toast.error(prepared.error);
      return;
    }

    setIsSaving(true);
    setSubmitError(null);
    const result = await requestLegalApi<LegalDocumentDetail>(
      DOCUMENT_FROM_TEMPLATE_URL,
      jsonRequest("POST", {
        content: prepared.content,
        document: buildTemplateDocumentPayload(values),
      }),
      "Gagal menyimpan dokumen",
    );
    setIsSaving(false);

    if (result.kind === "failure") {
      setSubmitError(result.message);
      toast.error(result.message);
      return;
    }
    toast.success("Dokumen legal disimpan");
    router.push(`/admin/legal/dokumen/${result.data.id}`);
  };

  return (
    <div className="space-y-6">
      <TemplatePageHeader
        backHref={TEMPLATE_LIST_PATH}
        backLabel="Template dokumen"
        title="Buat dokumen dari template"
        description={`Template: ${template.name}`}
        actions={
          <Button variant="primary" onClick={() => void save()} loading={isSaving}>
            Simpan sebagai dokumen legal
          </Button>
        }
      />

      {submitError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
        >
          {submitError}
        </p>
      )}

      <div className={WORKSPACE_GRID_CLASS}>
        <div className="space-y-6">
          <EditorCard title="Data dokumen">
            <RequiredFields mode="create" values={values} onChange={updateField} isTypeLocked />
            <DetailFields values={values} onChange={updateField} isInitiallyOpen />
            <LegalAttributeFields values={values} onChange={updateField} isInitiallyOpen />
            <ObligationRows
              obligations={values.obligations}
              onChange={(next) => updateField("obligations", next)}
            />
          </EditorCard>

          <EditorCard title="Isi dokumen">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Isi mengikuti template dan terisi otomatis dari data dokumen. Perubahan di sini
              hanya berlaku untuk dokumen ini — template tidak ikut berubah.
            </p>
            <CollapsibleSection title="Sesuaikan isi untuk dokumen ini">
              <BlockEditor
                blocks={blocks}
                onBlocksChange={setBlocks}
                placeholders={placeholders}
              />
            </CollapsibleSection>
          </EditorCard>
        </div>

        <PreviewPanel
          previewUrl={preview.previewUrl}
          isLoading={preview.isLoading}
          error={preview.error}
          onRefresh={() => void refreshPreview(blocks, buildPreviewDocument(values))}
        />
      </div>
    </div>
  );
}
