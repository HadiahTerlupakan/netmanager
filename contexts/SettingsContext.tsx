"use client";

import { createContext, useContext, useEffect, useState } from "react";
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

interface SettingsContextValue {
  settings: GeneralSettings | null;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
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

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }

  return context;
}
