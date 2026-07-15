"use client";

import { useEffect, useState } from "react";

interface MapSiteSelectProps {
  value: string | null | undefined;
  onChange: (siteId: string | null) => void;
  className?: string;
  labelClassName?: string;
}

export function MapSiteSelect({
  value,
  onChange,
  className,
  labelClassName,
}: MapSiteSelectProps) {
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/sites?activeOnly=true");
        if (!res.ok) return;
        const json = await res.json();
        const list = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.data?.sites)
            ? json.data.sites
            : [];
        if (!cancelled) {
          setSites(
            list.map((s: { id: string; name: string }) => ({
              id: s.id,
              name: s.name,
            })),
          );
        }
      } catch {
        setSites([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <label className={labelClassName}>Site (opsional)</label>
      <select
        className={className}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? e.target.value : null)}
      >
        <option value="">Tanpa site</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </div>
  );
}
