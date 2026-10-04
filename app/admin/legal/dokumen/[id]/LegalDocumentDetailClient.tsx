"use client";

import PageLoader from "@/components/ui/PageLoader";
import { useApi } from "@/lib/hooks/useApi";
import type {
  LegalDocumentDetail,
} from "../../components/legal-types";
import DocumentHeader from "./DocumentHeader";
import DocumentActions from "./DocumentActions";
import { AttributeSection, InformationSection } from "./InformationSections";
import { DeadlineSection, ObligationSection } from "./ScheduleSections";
import HistorySection from "./HistorySection";

/** Detail dokumen legal: info, atribut, tenggat, kewajiban, dan riwayat. */
export default function LegalDocumentDetailClient({
  documentId,
}: {
  documentId: string;
}) {
  const { data, error, isLoading, mutate } = useApi<
    LegalDocumentDetail
  >(`/api/admin/legal/documents/${documentId}`);
  const document = data;

  if (isLoading) return <PageLoader />;

  if (error || !document) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Gagal memuat detail dokumen legal.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <DocumentHeader document={document} />
        <DocumentActions
          document={document}
          onChanged={() => void mutate()}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InformationSection document={document} />
        <AttributeSection document={document} />
        <DeadlineSection deadlines={document.deadlines} />
        <ObligationSection obligations={document.obligations} />
      </div>

      <HistorySection document={document} />
    </div>
  );
}
