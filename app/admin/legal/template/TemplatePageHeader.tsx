import Link from "next/link";
import type { ReactNode } from "react";
import { HiOutlineArrowLeft, HiOutlineDocumentDuplicate } from "react-icons/hi2";

/** Kepala halaman template: tautan kembali, judul, keterangan, dan aksi di kanan. */
export default function TemplatePageHeader({
  backHref,
  backLabel,
  title,
  description,
  actions,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <HiOutlineArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <HiOutlineDocumentDuplicate className="h-6 w-6 shrink-0" />
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-gray-600 dark:text-gray-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
