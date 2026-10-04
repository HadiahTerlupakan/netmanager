"use client";

import Link from "next/link";
import { HiOutlinePlus } from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { buttonVariants } from "@/components/ui/Button";
import { DOCUMENT_TYPE_LABEL } from "../components/legal-format";
import { LEGAL_DOCUMENT_TYPES } from "../components/legal-types";
import TemplatePageHeader from "./TemplatePageHeader";
import TemplateTable from "./TemplateTable";
import { TEMPLATE_LIST_PATH, useLegalTemplates } from "./useLegalTemplates";

/** Daftar template dokumen legal per jenis: ubah, pakai, dan sakelar aktif. */
export default function LegalTemplateClient() {
  const { templates, error, isLoading, mutate } = useLegalTemplates();
  const refresh = (): void => {
    void mutate();
  };

  if (isLoading) return <PageLoader />;

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Gagal memuat template dokumen legal.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <TemplatePageHeader
        backHref="/admin/legal"
        backLabel="Dasbor legal"
        title="Template Dokumen"
        description="Susun surat legal (PKS, kontrak, surat kuasa) dari template, lalu simpan sebagai dokumen legal yang siap ditandatangani."
        actions={
          <Link href={`${TEMPLATE_LIST_PATH}/baru`} className={buttonVariants()}>
            <HiOutlinePlus />
            Tambah template
          </Link>
        }
      />

      <div className="space-y-4">
        {LEGAL_DOCUMENT_TYPES.map((type) => (
          <TemplateTable
            key={type}
            title={DOCUMENT_TYPE_LABEL[type]}
            templates={templates.filter((template) => template.documentType === type)}
            onChanged={refresh}
          />
        ))}
      </div>
    </div>
  );
}
