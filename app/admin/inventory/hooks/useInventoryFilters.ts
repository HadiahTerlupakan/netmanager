"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useEffect } from "react";
import { getWithAuth } from "@/lib/api-client";

export interface Site {
  id: string;
  name: string;
}

export interface Gudang {
  id: string;
  nama: string;
}

export interface FotoMetadata {
  [key: string]: unknown;
}

export interface InventoryFilters {
  search: string;
  startDate: string;
  endDate: string;
  siteId: string;
  gudangId: string;
}

interface UseInventoryFiltersReturn {
  filters: InventoryFilters;
  setFilter: <K extends keyof InventoryFilters>(
    key: K,
    value: InventoryFilters[K],
  ) => void;
  sites: Site[];
  gudangs: Gudang[];
  isLoading: boolean;
}

/** Fetches sites and gudangs for inventory filter dropdowns */
export function useInventoryFilters(): UseInventoryFiltersReturn {
  const [filters, setFilters] = useState<InventoryFilters>({
    search: "",
    startDate: "",
    endDate: "",
    siteId: "",
    gudangId: "",
  });
  const [sites, setSites] = useState<Site[]>([]);
  const [gudangs, setGudangs] = useState<Gudang[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Sites
        const siteRes = await getWithAuth("/api/admin/sites");
        if (siteRes.ok) {
          const data = await siteRes.json();
          setSites(data.data || []);
        }

        // Fetch Gudangs
        const gudangRes = await getWithAuth("/api/inventory/gudang?view=all");
        if (gudangRes.ok) {
          const data = await gudangRes.json();
          const result = data.data || data;
          setGudangs(result.gudangs || []);
        }
      } catch (err: unknown) {
        clientLogger.error("Failed to fetch filter data", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const setFilter = <K extends keyof InventoryFilters>(
    key: K,
    value: InventoryFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return { filters, setFilter, sites, gudangs, isLoading };
}
