import { useState, useEffect } from "react";
import {
  normalizeInvestorListResponse,
  type Category,
  type InvestorOption,
} from "../utils/rabFormHelpers";

export function useRABExternalData() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [investorsList, setInvestorsList] = useState<InvestorOption[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/finance/expense-categories");
        const data = await res.json();
        // expense-categories sudah memiliki type CAPEX/OPEX — simpan semua
        setCategories(
          Array.isArray(data?.data ?? data) ? (data?.data ?? data) : [],
        );
      } catch (error) {
        console.error("Failed fetching categories", error);
      }
    };

    const fetchInvestors = async () => {
      try {
        const res = await fetch("/api/admin/investors");
        if (res.ok) {
          const data = await res.json();
          setInvestorsList(normalizeInvestorListResponse(data));
        }
      } catch (error) {
        console.error("Failed fetching investors", error);
      }
    };

    fetchCategories();
    fetchInvestors();
  }, []);

  return {
    categories,
    investorsList,
  };
}
