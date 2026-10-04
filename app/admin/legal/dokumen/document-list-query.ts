/** Filter daftar dokumen legal dan penyusun query string-nya (murni). */

export const DOCUMENT_PAGE_SIZE = 20;

export interface DocumentListFilters {
  documentType: string;
  categoryId: string;
  status: string;
  search: string;
}

export const EMPTY_DOCUMENT_FILTERS: DocumentListFilters = {
  documentType: "",
  categoryId: "",
  status: "",
  search: "",
};

/** URL API daftar dokumen; filter kosong tidak ikut dikirim. */
export function buildDocumentListUrl(
  filters: DocumentListFilters,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const trimmed = value.trim();
    if (trimmed) params.set(key, trimmed);
  }
  params.set("page", String(page));
  params.set("limit", String(DOCUMENT_PAGE_SIZE));

  return `/api/admin/legal/documents?${params.toString()}`;
}

/** Jumlah halaman minimal 1 agar navigasi tetap tampil konsisten. */
export function countPages(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}
