import { clientLogger } from "@/lib/client-logger";
export type PppConnectionMode = "RADIUS" | "MIKROTIK_API";

export type RadiusDefaults = {
  authPort: number;
  accountingPort: number;
  radiusSecret: string;
};

export type MikrotikFormConnectionData = {
  ipAddress: string;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
};

export type MikrotikTestConnectionResult = {
  success: boolean;
  api: { success: boolean; message: string };
  ping?: { success: boolean; message: string };
  routerInfo?: {
    identity?: string;
    version?: string;
    boardName?: string;
    uptime?: string;
    userOnline?: number;
  };
  message: string;
};

type GeneralSettingsResponse = {
  data?: {
    pppConnectionMode?: unknown;
  };
};

type RadiusDefaultsResponse = {
  authPort?: unknown;
  accountingPort?: unknown;
  radiusSecret?: unknown;
};

const defaultRadiusDefaults: RadiusDefaults = {
  authPort: 1812,
  accountingPort: 1813,
  radiusSecret: "testing123",
};

const isPppConnectionMode = (value: unknown): value is PppConnectionMode => {
  return value === "RADIUS" || value === "MIKROTIK_API";
};

const getNumberOrFallback = (value: unknown, fallback: number): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const getStringOrFallback = (value: unknown, fallback: string): string => {
  return typeof value === "string" && value.length > 0 ? value : fallback;
};

export async function fetchMikrotikFormSettings(): Promise<{
  pppConnectionMode: PppConnectionMode;
  radiusDefaults: RadiusDefaults;
}> {
  let pppConnectionMode: PppConnectionMode = "RADIUS";
  let radiusDefaults = defaultRadiusDefaults;

  try {
    const generalSettingsRes = await fetch("/api/settings/general");
    const generalSettingsData =
      (await generalSettingsRes.json()) as GeneralSettingsResponse;
    if (isPppConnectionMode(generalSettingsData.data?.pppConnectionMode)) {
      pppConnectionMode = generalSettingsData.data.pppConnectionMode;
    }
  } catch (error) {
    clientLogger.error("Failed to load general settings:", error);
  }

  try {
    const radiusDefaultsRes = await fetch("/api/settings/radius-defaults");
    const radiusDefaultsData =
      (await radiusDefaultsRes.json()) as RadiusDefaultsResponse;
    radiusDefaults = {
      authPort: getNumberOrFallback(
        radiusDefaultsData.authPort,
        defaultRadiusDefaults.authPort,
      ),
      accountingPort: getNumberOrFallback(
        radiusDefaultsData.accountingPort,
        defaultRadiusDefaults.accountingPort,
      ),
      radiusSecret: getStringOrFallback(
        radiusDefaultsData.radiusSecret,
        defaultRadiusDefaults.radiusSecret,
      ),
    };
  } catch (error) {
    clientLogger.error("Failed to load RADIUS defaults:", error);
  }

  return {
    pppConnectionMode,
    radiusDefaults,
  };
}

export function validateMikrotikConnectionInput(
  formData: MikrotikFormConnectionData,
): string | null {
  if (!formData.ipAddress) {
    return "IP Address harus diisi terlebih dahulu";
  }

  if (!formData.apiUsername || !formData.apiPassword) {
    return "Username API dan Password API harus diisi untuk test koneksi";
  }

  return null;
}

export async function submitMikrotikConnectionTest(
  formData: MikrotikFormConnectionData,
  routerId?: string,
): Promise<MikrotikTestConnectionResult> {
  const requestBody: {
    ipAddress: string;
    apiPort: number;
    apiUsername: string;
    apiPassword: string;
    routerId?: string;
  } = {
    ipAddress: formData.ipAddress,
    apiPort: formData.apiPort,
    apiUsername: formData.apiUsername,
    apiPassword: formData.apiPassword,
  };

  if (routerId) {
    requestBody.routerId = routerId;
  }

  const res = await fetch("/api/mikrotik-routers/test-connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  const result = await res.json();

  if (result && typeof result === "object") {
    return result as MikrotikTestConnectionResult;
  }

  return {
    success: false,
    api: { success: false, message: "Respons API tidak valid" },
    ping: { success: false, message: "Respons API tidak valid" },
    message: "Terjadi kesalahan saat test koneksi",
  };
}
