"use client";

import { useApi } from "@/lib/hooks/useApi";
import type { LegalCategory } from "./legal-types";

export const LEGAL_CATEGORIES_URL = "/api/admin/legal/categories";

/** Kategori legal yang boleh dilihat pengguna (cache dibagi antarkomponen). */
export function useLegalCategories() {
  const { data, error, isLoading, mutate } = useApi<
    { items: LegalCategory[] }
  >(LEGAL_CATEGORIES_URL);

  return {
    categories: data?.items ?? [],
    error,
    isLoading,
    mutate,
  };
}
