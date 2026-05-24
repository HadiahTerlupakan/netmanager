"use client";

import { useEffect, useState } from "react";

const FULL_RADIUS_MODE_EVENT = "fullRadiusMode:changed";

/**
 * Status setting global Full RADIUS Mode untuk konsumsi client-side.
 * Sumber kebenaran: `/api/admin/settings/full-radius-mode`.
 *
 * Why: dipakai sidebar untuk hide menu accel-ppp saat toggle OFF, dan
 * komponen settings untuk broadcast perubahan ke seluruh tab. Dengan
 * `dispatchFullRadiusModeChange()`, halaman lain bisa langsung
 * menyesuaikan tanpa harus reload manual.
 */
export function useFullRadiusMode() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const refresh = async () => {
      try {
        const res = await fetch("/api/admin/settings/full-radius-mode", {
          cache: "no-store",
        });
        if (!alive) return;
        if (!res.ok) {
          setEnabled(false);
          return;
        }
        const json = await res.json();
        setEnabled(Boolean(json.data?.enabled));
      } catch {
        if (!alive) return;
        setEnabled(false);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void refresh();

    const handler = () => {
      void refresh();
    };
    if (typeof window !== "undefined") {
      window.addEventListener(FULL_RADIUS_MODE_EVENT, handler);
    }

    return () => {
      alive = false;
      if (typeof window !== "undefined") {
        window.removeEventListener(FULL_RADIUS_MODE_EVENT, handler);
      }
    };
  }, []);

  return { enabled: enabled ?? false, loading };
}

/**
 * Notifikasikan ke seluruh window listener bahwa Full RADIUS Mode baru saja
 * berubah—sidebar dan komponen lain akan re-fetch tanpa user F5 manual.
 */
export function dispatchFullRadiusModeChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FULL_RADIUS_MODE_EVENT));
  }
}
