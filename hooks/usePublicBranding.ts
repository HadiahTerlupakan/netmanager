"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_PUBLIC_APP_LOGO_URL,
  DEFAULT_PUBLIC_APP_NAME,
} from "@/lib/settings/publicBranding";

export { DEFAULT_PUBLIC_APP_LOGO_URL, DEFAULT_PUBLIC_APP_NAME };

export type PublicBranding = {
  namaAplikasi: string;
  appLogoUrl: string;
};

type PublicBrandingPayload = Record<string, unknown>;

function isPayloadObject(value: unknown): value is PublicBrandingPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapPayload(payload: unknown): PublicBrandingPayload {
  let unwrappedPayload = payload;

  while (
    isPayloadObject(unwrappedPayload) &&
    isPayloadObject(unwrappedPayload.data)
  ) {
    unwrappedPayload = unwrappedPayload.data;
  }

  return isPayloadObject(unwrappedPayload) ? unwrappedPayload : {};
}

function normalizeBrandingValue(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export function parsePublicBrandingPayload(
  payload: unknown,
): PublicBranding | null {
  const unwrappedPayload = unwrapPayload(payload);
  const namaAplikasi = normalizeBrandingValue(unwrappedPayload.namaAplikasi);
  const appLogoUrl = normalizeBrandingValue(unwrappedPayload.appLogoUrl);

  if (!namaAplikasi && !appLogoUrl) {
    return null;
  }

  return { namaAplikasi, appLogoUrl };
}

export function usePublicBranding() {
  const [branding, setBranding] = useState<PublicBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchPublicBranding() {
      try {
        const response = await fetch("/api/settings/public");

        if (!response.ok) {
          throw new Error("Failed to fetch public branding");
        }

        const payload = await response.json();
        const parsedBranding = parsePublicBrandingPayload(payload);

        if (isMounted) {
          setBranding(parsedBranding);
        }
      } catch {
        if (isMounted) {
          setError("Gagal memuat branding publik");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchPublicBranding();

    return () => {
      isMounted = false;
    };
  }, []);

  return { branding, loading, error };
}
