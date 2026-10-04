import Link from "next/link";
import { HiOutlineArrowLeft, HiOutlinePaperClip } from "react-icons/hi2";
import {
  ConfidentialBadge,
  LegalStatusBadge,
} from "../../components/LegalBadges";
import { DOCUMENT_TYPE_LABEL, labelOf } from "../../components/legal-format";
import type { LegalDocumentDetail } from "../../components/legal-types";

/** Kepala detail: tautan kembali, judul, jenis/kategori, lencana, dan berkas. */
export default function DocumentHeader({
  document,
}: {
  document: LegalDocumentDetail;
}) {
  const subtitle = [
    labelOf(DOCUMENT_TYPE_LABEL, document.documentType),
    document.categoryName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <Link
        href="/admin/legal/dokumen"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <HiOutlineArrowLeft className="h-4 w-4" />
        Kembali ke daftar
      </Link>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {document.title}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <LegalStatusBadge status={document.status} />
        {document.isConfidential && <ConfidentialBadge />}
        <a
          href={`/api/admin/legal/documents/${document.id}/file`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          <HiOutlinePaperClip className="h-4 w-4" />
          {document.fileName}
        </a>
      </div>
    </div>
  );
}
