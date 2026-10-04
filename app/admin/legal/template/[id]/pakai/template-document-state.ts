import {
  buildLegalPayload,
  createEmptyFormValues,
  isIndefiniteByDefault,
  type LegalFormValues,
} from "../../../components/form/legal-form-state";
import type { LegalTemplate } from "../../../components/legal-types";
import type { TemplatePreviewDocument } from "../../editor/useTemplatePreview";

/**
 * Formulir dokumen yang disusun dari template — murni (tanpa React). Memakai
 * ulang aturan payload dokumen legal biasa agar kedua jalur selalu sama.
 */

const PREVIEW_DOCUMENT_FIELDS = [
  "title",
  "documentNumber",
  "partyName",
  "partyType",
  "partyId",
  "startDate",
  "endDate",
  "value",
] as const satisfies readonly (keyof TemplatePreviewDocument)[];

/** Formulir awal: judul = nama template, jenis & kategori mengikuti template. */
export function formValuesFromTemplate(template: LegalTemplate): LegalFormValues {
  return {
    ...createEmptyFormValues(),
    title: template.name,
    documentType: template.documentType,
    categoryId: template.category?.id ?? "",
    isIndefinite: isIndefiniteByDefault(template.documentType),
  };
}

/** Payload dokumen untuk API — sama persis dengan pembuatan dokumen legal biasa. */
export function buildTemplateDocumentPayload(values: LegalFormValues): Record<string, unknown> {
  return buildLegalPayload(values, "create");
}

/** Data dokumen yang mengisi {{kunci}} di pratinjau PDF. */
export function buildPreviewDocument(values: LegalFormValues): TemplatePreviewDocument {
  const payload = buildTemplateDocumentPayload(values);

  return Object.fromEntries(
    PREVIEW_DOCUMENT_FIELDS.map((field) => [field, payload[field] ?? null]),
  ) as TemplatePreviewDocument;
}
