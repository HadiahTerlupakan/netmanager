"use client";

import { useRouter } from "next/navigation";
import PageLoader from "@/components/ui/PageLoader";
import { templateEditorPath, useLegalTemplate, useLegalTemplates } from "../useLegalTemplates";
import TemplateEditorForm from "./TemplateEditorForm";

/**
 * Halaman editor template: memuat template (bila mengubah) dan daftar isian,
 * lalu menyegarkan cache setelah disimpan. Template baru diarahkan ke
 * halaman ubahnya agar penyuntingan bisa dilanjutkan.
 */
export default function LegalTemplateEditorClient({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const templateList = useLegalTemplates();
  const { template, error, isLoading, mutate } = useLegalTemplate(templateId ?? null);

  if (templateList.isLoading || isLoading) return <PageLoader />;

  if (error || templateList.error || (templateId && !template)) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">Gagal memuat template dokumen.</p>
    );
  }

  return (
    <TemplateEditorForm
      key={template?.id ?? "baru"}
      template={template}
      placeholders={templateList.placeholders}
      onSaved={(saved) => {
        void templateList.mutate();
        if (templateId) {
          void mutate();
          return;
        }
        router.replace(templateEditorPath(saved.id));
      }}
    />
  );
}
