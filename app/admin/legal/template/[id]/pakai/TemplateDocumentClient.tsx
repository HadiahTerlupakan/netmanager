"use client";

import PageLoader from "@/components/ui/PageLoader";
import { useLegalTemplate, useLegalTemplates } from "../../useLegalTemplates";
import TemplateDocumentForm from "./TemplateDocumentForm";

/** Halaman "buat dokumen dari template": memuat template dan daftar isian. */
export default function TemplateDocumentClient({ templateId }: { templateId: string }) {
  const templateList = useLegalTemplates();
  const { template, error, isLoading } = useLegalTemplate(templateId);

  if (templateList.isLoading || isLoading) return <PageLoader />;

  if (error || templateList.error || !template) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">Gagal memuat template dokumen.</p>
    );
  }

  return (
    <TemplateDocumentForm
      key={template.id}
      template={template}
      placeholders={templateList.placeholders}
    />
  );
}
