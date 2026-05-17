"use client";

import { clientLogger } from "@/lib/client-logger";
import { useCallback, useEffect, useState } from "react";

export interface GatewayConfig {
  id: string;
  provider: string;
  isEnabled: boolean;
  isProduction: boolean;
  priority: number;
  apiKey?: string;
  apiSecret?: string;
  clientKey?: string;
  merchantId?: string;
  lastTestedAt?: string;
  testStatus?: "SUCCESS" | "FAILED";
}

export interface PaymentGatewayFormPayload {
  isProduction: boolean;
  priority: number;
  apiKey: string;
  apiSecret: string;
  clientKey: string;
  merchantId: string;
}

interface PaymentGatewayTestPayload extends PaymentGatewayFormPayload {
  provider: string;
}

export interface PaymentActionResult {
  success: boolean;
  message?: string;
}

const CONFIGS_URL = "/api/admin/payment-gateway/configs";
const TEST_URL = "/api/admin/payment-gateway/test";

async function safeParseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractConfigs(payload: unknown): GatewayConfig[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const data = (payload as Record<string, unknown>).data;
    if (Array.isArray(data)) {
      return data;
    }
  }

  return [];
}

function getPayloadMessage(payload: unknown): string | undefined {
  if (payload && typeof payload === "object") {
    const message = (payload as Record<string, unknown>).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }

    const details = (payload as Record<string, unknown>).details;
    if (typeof details === "string" && details.length > 0) {
      return details;
    }

    const error = (payload as Record<string, unknown>).error;
    if (typeof error === "string" && error.length > 0) {
      return error;
    }
  }

  return undefined;
}

export function usePaymentGatewayConfigs() {
  const [configs, setConfigs] = useState<GatewayConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(CONFIGS_URL);
      if (response.ok) {
        const payload = await safeParseJson(response);
        const normalized = extractConfigs(payload);
        setConfigs(normalized);
      } else {
        clientLogger.error(
          "Failed to fetch payment gateway configs:",
          response.statusText,
        );
      }
    } catch (error) {
      clientLogger.error("Error fetching payment gateway configs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      void fetchConfigs();
    }, 0);
    return () => clearTimeout(handle);
  }, [fetchConfigs]);

  const toggleProvider = useCallback(
    async (
      providerId: string,
      isEnabled: boolean,
    ): Promise<PaymentActionResult> => {
      try {
        const response = await fetch(`${CONFIGS_URL}/${providerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isEnabled }),
        });

        if (response.ok) {
          await fetchConfigs();
          return { success: true };
        }

        const payload = await safeParseJson(response);
        return {
          success: false,
          message:
            getPayloadMessage(payload) ?? "Gagal mengupdate status provider",
        };
      } catch (error) {
        clientLogger.error("Error toggling provider:", error);
        return {
          success: false,
          message: "Kesalahan saat mengupdate provider",
        };
      }
    },
    [fetchConfigs],
  );

  const saveConfig = useCallback(
    async (
      providerId: string,
      payload: PaymentGatewayFormPayload,
    ): Promise<PaymentActionResult> => {
      try {
        setSaving(true);
        const response = await fetch(`${CONFIGS_URL}/${providerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          await fetchConfigs();
          return { success: true };
        }

        const body = await safeParseJson(response);
        return {
          success: false,
          message: getPayloadMessage(body) ?? "Gagal menyimpan konfigurasi",
        };
      } catch (error) {
        clientLogger.error("Error saving payment gateway config:", error);
        return {
          success: false,
          message: "Kesalahan saat menyimpan konfigurasi",
        };
      } finally {
        setSaving(false);
      }
    },
    [fetchConfigs],
  );

  const testConnection = useCallback(
    async (
      payload: PaymentGatewayTestPayload,
    ): Promise<PaymentActionResult> => {
      try {
        setTesting(true);
        const response = await fetch(TEST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const body = await safeParseJson(response);
        const successFlag =
          body && typeof (body as Record<string, unknown>).success === "boolean"
            ? ((body as Record<string, unknown>).success as boolean)
            : response.ok;

        return {
          success: successFlag,
          message:
            getPayloadMessage(body) ??
            (successFlag ? "Koneksi berhasil" : "Koneksi gagal"),
        };
      } catch (error) {
        clientLogger.error("Error testing payment gateway connection:", error);
        return { success: false, message: "Kesalahan saat testing koneksi" };
      } finally {
        setTesting(false);
      }
    },
    [],
  );

  return {
    configs,
    loading,
    saving,
    testing,
    fetchConfigs,
    toggleProvider,
    saveConfig,
    testConnection,
  };
}
