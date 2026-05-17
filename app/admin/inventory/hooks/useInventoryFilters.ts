"use client";

import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/hooks/useApi";

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

interface SitesResponse {
  data?: Site[];
}

interface GudangResponse {
  gudangs?: Gudang[];
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

  const {
    data: siteData,
    isLoading: loadingSites,
    error: sitesError,
  } = useApi<Site[] | SitesResponse>("/api/admin/sites");
  const sites: Site[] = Array.isArray(siteData)
    ? siteData
    : (siteData?.data ?? []);

  const {
    data: gudangData,
    isLoading: loadingGudangs,
    error: gudangsError,
  } = useApi<GudangResponse>("/api/inventory/gudang?view=all");
  const gudangs: Gudang[] = gudangData?.gudangs ?? [];

  useEffect(() => {
    if (sitesError || gudangsError) {
      clientLogger.error("Failed to fetch filter data", {
        sitesError,
        gudangsError,
      });
    }
  }, [sitesError, gudangsError]);

  const isLoading = loadingSites || loadingGudangs;

  const setFilter = <K extends keyof InventoryFilters>(
    key: K,
    value: InventoryFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return { filters, setFilter, sites, gudangs, isLoading };
}
