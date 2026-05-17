import { useMemo } from "react";
import {
  normalizeInvestorListResponse,
  type Category,
  type InvestorOption,
} from "../utils/rabFormHelpers";
import { useApi } from "@/lib/hooks/useApi";

export function useRABExternalData() {
  const { data: categoriesRaw } = useApi<Category[] | { data?: Category[] }>(
    "/api/finance/expense-categories",
  );
  const { data: investorsRaw } = useApi<unknown>("/api/admin/investors");

  const categories = useMemo<Category[]>(() => {
    const inner = Array.isArray(categoriesRaw)
      ? categoriesRaw
      : (categoriesRaw as { data?: Category[] } | undefined)?.data;
    return Array.isArray(inner) ? inner : [];
  }, [categoriesRaw]);

  const investorsList = useMemo<InvestorOption[]>(() => {
    if (!investorsRaw) return [];
    return normalizeInvestorListResponse(investorsRaw);
  }, [investorsRaw]);

  return {
    categories,
    investorsList,
  };
}
