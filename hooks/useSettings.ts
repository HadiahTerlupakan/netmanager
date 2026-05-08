import { useState, useEffect } from "react";
import { mergeSettingsPayload } from "@/lib/settings/mergeSettingsPayload";
import { clientLogger } from "@/lib/client-logger";

type GeneralSettings = {
  perusahaan: string;
  namaAplikasi: string;
  alamat: string;
  nomorHp: string;
  deskripsiInvoice: string;
  rekeningBank: unknown[];
  invoiceOtomatis: string;
  disablePerpanjanganPaket: string;
  timezone: string;
  pppConnectionMode?: "RADIUS" | "MIKROTIK_API";
  logoInvoice?: string | null;
  logoAplikasi?: string | null;
};

export function useSettings() {
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const [generalRes, logoRes] = await Promise.all([
          fetch("/api/settings/general/public"),
          fetch("/api/settings/logo/public"),
        ]);

        if (generalRes.ok) {
          const generalPayload = await generalRes.json();
          let logoPayload: unknown;

          if (logoRes.ok) {
            logoPayload = await logoRes.json();
          }

          setSettings(
            mergeSettingsPayload(
              generalPayload,
              logoPayload,
            ) as GeneralSettings,
          );
        }
      } catch (error) {
        clientLogger.error("Failed to fetch settings:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  return { settings, loading };
}
