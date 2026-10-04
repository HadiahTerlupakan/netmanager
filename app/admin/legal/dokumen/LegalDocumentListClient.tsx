"use client";

import Link from "next/link";
import { useState } from "react";
import { HiOutlineArrowLeft, HiOutlineDocumentText } from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { useDebounce } from "@/hooks/useDebounce";
import { useApi } from "@/lib/hooks/useApi";
import AddLegalDocumentButton from "../components/AddLegalDocumentButton";
import type {
  LegalDocumentListItem,
} from "../components/legal-types";
import {
  buildDocumentListUrl,
  EMPTY_DOCUMENT_FILTERS,
  type DocumentListFilters,
} from "./document-list-query";
import LegalDocumentFilterBar from "./LegalDocumentFilterBar";
import LegalDocumentTable from "./LegalDocumentTable";
import ListPagination from "./ListPagination";

/** Daftar dokumen legal dengan filter jenis/kategori/status dan pencarian. */

const SEARCH_DEBOUNCE_MS = 400;

interface DocumentListPage {
  items: LegalDocumentListItem[];
  total: number;
  page: number;
  limit: number;
}

export default function LegalDocumentListClient({
  initialStatus,
  initialDocumentType,
}: {
  initialStatus: string;
  initialDocumentType: string;
}) {
  const [filters, setFilters] = useState<DocumentListFilters>({
    ...EMPTY_DOCUMENT_FILTERS,
    status: initialStatus,
    documentType: initialDocumentType,
  });
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(filters.search, SEARCH_DEBOUNCE_MS);

  const { data, error, isLoading } = useApi<DocumentListPage>(
    buildDocumentListUrl({ ...filters, search: debouncedSearch }, page),
  );
  const result = data;

  const changeFilters = (next: DocumentListFilters) => {
    setFilters(next);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link
            href="/admin/legal"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <HiOutlineArrowLeft className="h-4 w-4" />
            Dasbor legal
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <HiOutlineDocumentText className="h-6 w-6" />
            Dokumen Legal
          </h1>
        </div>
        <AddLegalDocumentButton />
      </div>

      <LegalDocumentFilterBar filters={filters} onChange={changeFilters} />

      {isLoading && <PageLoader variant="section" />}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Gagal memuat daftar dokumen legal.
        </p>
      )}
      {result && (
        <>
          <LegalDocumentTable items={result.items} />
          <ListPagination
            page={result.page}
            limit={result.limit}
            total={result.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
