"use client";

import { DOCUMENT_TYPE_LABEL, STATUS_LABEL } from "../components/legal-format";
import {
  LEGAL_DOCUMENT_STATUSES,
  LEGAL_DOCUMENT_TYPES,
} from "../components/legal-types";
import { useLegalCategories } from "../components/useLegalCategories";
import type { DocumentListFilters } from "./document-list-query";

/** Baris filter daftar dokumen; pilihan kategori mengikuti jenis terpilih. */

const FILTER_CLASS =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white";

export default function LegalDocumentFilterBar({
  filters,
  onChange,
}: {
  filters: DocumentListFilters;
  onChange: (next: DocumentListFilters) => void;
}) {
  const { categories } = useLegalCategories();
  const categoryOptions = filters.documentType
    ? categories.filter((category) => category.documentType === filters.documentType)
    : categories;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <input
        type="search"
        value={filters.search}
        onChange={(event) => onChange({ ...filters, search: event.target.value })}
        className={`${FILTER_CLASS} sm:w-64`}
        placeholder="Cari judul, nomor, atau pihak"
        aria-label="Cari dokumen"
      />
      <select
        value={filters.documentType}
        onChange={(event) =>
          onChange({ ...filters, documentType: event.target.value, categoryId: "" })
        }
        className={FILTER_CLASS}
        aria-label="Filter jenis"
      >
        <option value="">Semua jenis</option>
        {LEGAL_DOCUMENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {DOCUMENT_TYPE_LABEL[type]}
          </option>
        ))}
      </select>
      <select
        value={filters.categoryId}
        onChange={(event) => onChange({ ...filters, categoryId: event.target.value })}
        className={FILTER_CLASS}
        aria-label="Filter kategori"
      >
        <option value="">Semua kategori</option>
        {categoryOptions.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <select
        value={filters.status}
        onChange={(event) => onChange({ ...filters, status: event.target.value })}
        className={FILTER_CLASS}
        aria-label="Filter status"
      >
        <option value="">Semua status</option>
        {LEGAL_DOCUMENT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABEL[status]}
          </option>
        ))}
      </select>
    </div>
  );
}
