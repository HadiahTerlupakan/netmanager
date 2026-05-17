"use client";

import { useEffect, useMemo, useState } from "react";
import { HiOutlineMap } from "react-icons/hi2";
import { useApi } from "@/lib/hooks/useApi";

interface Site {
  id: string;
  name: string;
}

interface SiteFilterProps {
  onSiteChange: (siteId: string | undefined) => void;
  className?: string | undefined;
  isInput?: boolean | undefined; // If true, behaves like a form input (auto-selects & shows static if single site)
  value?: string | undefined;
  resource?: string;
}

export function SiteFilter({
  onSiteChange,
  className = "",
  isInput = false,
  value,
  resource,
}: SiteFilterProps) {
  const [selectedSite, setSelectedSite] = useState<string>(value || "");

  const url = resource ? `/api/sites?resource=${resource}` : "/api/sites";
  const { data, isLoading: loading } = useApi<{ sites?: Site[] }>(url);
  const sites = useMemo(() => data?.sites ?? [], [data?.sites]);

  // Sync with value prop if provided
  useEffect(() => {
    if (value !== undefined) {
      // Defer state update to avoid synchronous setState in effect
      requestAnimationFrame(() => {
        setSelectedSite(value);
      });
    }
  }, [value]);

  // Auto-select single site for input mode
  useEffect(() => {
    if (isInput && !loading && sites.length === 1 && !selectedSite) {
      const singleSite = sites[0];
      if (singleSite) {
        requestAnimationFrame(() => {
          setSelectedSite(singleSite.id);
          onSiteChange(singleSite.id);
        });
      }
    }
  }, [loading, sites, selectedSite, onSiteChange, isInput]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedSite(val);
    onSiteChange(val === "" ? undefined : val);
  };

  if (loading)
    return <div className="animate-pulse h-10 w-48 bg-gray-200 rounded"></div>;

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <HiOutlineMap className="h-5 w-5 text-gray-400" />
      </div>

      {/* 
        Render Static Text ONLY if:
        1. We are in Input Mode (isInput=true)
        2. AND There is only 1 site available
      */}
      {isInput && sites.length === 1 ? (
        <div className="block w-full pl-10 pr-3 py-2 text-base border border-gray-200 bg-gray-50 text-gray-500 rounded-md sm:text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
          {sites[0]?.name}{" "}
          <span className="text-xs ml-1 text-gray-400">(Otomatis)</span>
        </div>
      ) : (
        <select
          value={selectedSite}
          onChange={handleChange}
          className="block w-full rounded-lg border-0 py-2.5 pl-10 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600 transition-all"
        >
          <option value="">Semua Site</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
