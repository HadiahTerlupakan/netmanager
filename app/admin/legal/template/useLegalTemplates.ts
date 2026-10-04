"use client";

import { useApi } from "@/lib/hooks/useApi";
import type { LegalTemplate, TemplatePlaceholder } from "../components/legal-types";

export const LEGAL_TEMPLATES_URL = "/api/admin/legal/templates";
export const TEMPLATE_PREVIEW_URL = `${LEGAL_TEMPLATES_URL}/preview`;
export const DOCUMENT_FROM_TEMPLATE_URL = "/api/admin/legal/documents/from-template";
export const TEMPLATE_LIST_PATH = "/admin/legal/template";

/** Alamat halaman editor satu template. */
export function templateEditorPath(templateId: string): string {
  return `${TEMPLATE_LIST_PATH}/${templateId}`;
}

/** Alamat halaman "buat dokumen dari template". */
export function templateUsePath(templateId: string): string {
  return `${TEMPLATE_LIST_PATH}/${templateId}/pakai`;
}

/** Daftar template tenant beserta isian yang tersedia (cache dibagi antarkomponen). */
export function useLegalTemplates() {
  const { data, error, isLoading, mutate } = useApi<{
    items: LegalTemplate[];
    placeholders: TemplatePlaceholder[];
  }>(LEGAL_TEMPLATES_URL);

  return {
    templates: data?.items ?? [],
    placeholders: data?.placeholders ?? [],
    error,
    isLoading,
    mutate,
  };
}

/** Satu template beserta isinya; `null` = tidak memuat apa pun (template baru). */
export function useLegalTemplate(templateId: string | null) {
  const { data, error, isLoading, mutate } = useApi<LegalTemplate>(
    templateId ? `${LEGAL_TEMPLATES_URL}/${templateId}` : null,
  );

  return { template: data, error, isLoading, mutate };
}
