"use client";

import { useEffect, useState } from "react";
import { HiOutlineMap } from "react-icons/hi2";
import { clientLogger } from "@/lib/client-logger";

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
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>(value || "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = resource ? `/api/sites?resource=${resource}` : "/api/sites";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setSites(data.sites || []);
        setLoading(false);
      })
      .catch((err) => {
        clientLogger.error("Failed to fetch sites:", err);
        setLoading(false);
      });
  }, [resource]);

  // Sync with value prop if provided
  useEffect(() => {
    if (value !== undefined) {
      // Defer state update to avoid synchronous setState in effect
      requestAnimationFrame(() => {
        setSelectedSite(value);
      });
    }
  }, [value]);

  // Auto-select if only one site exists (e.g., restricted admin) AND it is an input field
  // Or if it is a filter, we might still want to auto-select if restricted, but KEEP the dropdown visible?
  // Actually, for restricted admin in Filter List, they can ONLY see their site. So Static Display is also fine there?
  // User COMPLAINED about List Dropdown not being selectable.
  // If restricted admin, they only get 1 site. If static, they can't select "All". But "All" = "Site A".
  // Maybe the user IS NOT restricted? But if not restricted, they get 3 sites -> Dropdown.

  // Let's assume the user wants the dropdown for FILTERING even if 1 site.
  // So we only use Static Display if isInput={true} (Form Mode).

  useEffect(() => {
    // If input mode (required selection), auto-select single site
    if (isInput && !loading && sites.length === 1 && !selectedSite) {
      const singleSite = sites[0];
      if (singleSite) {
        // Defer state updates to avoid synchronous setState in effect
        requestAnimationFrame(() => {
          setSelectedSite(singleSite.id);
          onSiteChange(singleSite.id);
        });
      }
    }
    // If filter mode, we usually default to "Semua Site" (''), unless we want to force?
    // Let's leave filter mode as manual selection (default ''), enabling 'Semua Site'.
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
