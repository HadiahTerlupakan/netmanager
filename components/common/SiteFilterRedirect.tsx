"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SiteFilter } from "@/components/common/SiteFilter";

interface SiteFilterRedirectProps {
  baseUrl: string;
  className?: string;
  /** Resource yang `site_only`-nya membatasi pilihan site (lihat SiteFilter). */
  resource?: string;
}

export default function SiteFilterRedirect({
  baseUrl,
  className,
  resource,
}: SiteFilterRedirectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSiteId = searchParams.get("siteId") || undefined;

  const handleSiteChange = (siteId: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (siteId) {
      params.set("siteId", siteId);
    } else {
      params.delete("siteId");
    }
    router.push(`${baseUrl}?${params.toString()}`);
  };

  return (
    <SiteFilter
      value={currentSiteId}
      onSiteChange={handleSiteChange}
      className={className}
      resource={resource}
    />
  );
}
