import { clientLogger } from "@/lib/client-logger";
import { VPN_API_PORT } from "@/modules/network/vpn/constants";
export type PppConnectionMode = "RADIUS" | "MIKROTIK_API";

export type RadiusDefaults = {
  authPort: number;
  accountingPort: number;
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
};

const defaultRadiusDefaults: RadiusDefaults = {
  authPort: 1812,
  accountingPort: 1813,
};

const isPppConnectionMode = (value: unknown): value is PppConnectionMode => {
  return value === "RADIUS" || value === "MIKROTIK_API";
};

const getNumberOrFallback = (value: unknown, fallback: number): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
  formData: MikrotikVpnFormFields,
  routerId?: string,
): Promise<MikrotikTestConnectionResult> {
  const requestBody: {
    ipAddress: string;
    apiPort: number;
    apiUsername: string;
    apiPassword: string;
    routerId?: string;
    vpnDraftId?: string;
  } = {
    ipAddress: formData.ipAddress,
    apiPort: formData.apiPort,
    apiUsername: formData.apiUsername,
    apiPassword: formData.apiPassword,
  };

  if (routerId) {
    requestBody.routerId = routerId;
  }
  // Rute hanya mengizinkan test ke alamat overlay milik draft VPN tenant.
  if (formData.vpnDraftId) {
    requestBody.vpnDraftId = formData.vpnDraftId;
  }

  const res = await fetch("/api/mikrotik-routers/test-connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  const body: unknown = await res.json();

  if (!body || typeof body !== "object") {
    return failedTestResult("Respons API tidak valid");
  }
  const { data, error, message } = body as {
    data?: unknown;
    error?: unknown;
    message?: unknown;
  };
  // Rute membungkus hasil sebagai `{success: true, data}`; `success` amplop
  // hanya berarti rute berjalan, bukan router tersambung.
  if (res.ok && data && typeof data === "object") {
    return data as MikrotikTestConnectionResult;
  }
  const reason =
    [error, message].find((v) => typeof v === "string" && v) ??
    "Respons API tidak valid";
  return failedTestResult(reason as string);
}

function failedTestResult(reason: string): MikrotikTestConnectionResult {
  return {
    success: false,
    api: { success: false, message: reason },
    ping: { success: false, message: reason },
    message: reason,
  };
}

/** Versi RouterOS yang dipilih di form router. */
export type RouterOsVersion = "V6" | "V7";

/** Cara aplikasi menjangkau router: IP publik atau tunnel VPN. */
export type RouterConnectionMode = "PUBLIC" | "VPN";

export { VPN_API_PORT };

/** Versi mayor RouterOS minimum: script VPN memakai WireGuard (RouterOS v7). */
const MIN_VPN_ROUTEROS_MAJOR = 7;

/** Pesan gagal bila router yang tersambung lewat VPN bukan RouterOS v7. */
export const VPN_ROUTEROS_VERSION_ERROR = "RouterOS harus versi 7";

/** Server VPN yang boleh dipakai tenant (`GET /api/vpn-servers`). */
export type VpnServerOption = {
  id: string;
  name: string;
  publicHost: string;
  status: string;
};

/** Draft VPN dari `POST /api/mikrotik-routers/vpn-draft`. */
export type VpnDraft = {
  draftId: string;
  address: string;
  apiUsername: string;
  apiPassword: string;
  script: string;
};

/** Field form router yang diatur mode VPN. */
export type MikrotikVpnFormFields = MikrotikFormConnectionData & {
  rosVersion?: RouterOsVersion;
  connectionMode?: RouterConnectionMode;
  vpnServerIds?: string[];
  vpnDraftId?: string;
};

const HTTP_BAD_REQUEST = 400;
const HTTP_BAD_GATEWAY = 502;

/**
 * True bila aktivasi VPN gagal dengan status yang membuat draft tak boleh
 * dipakai lagi: claim yang gagal (502) menjadwalkan draft dihapus di core, dan
 * 400 menolak draft itu, jadi form harus meminta script baru.
 */
export function isVpnDraftSpent(status: number): boolean {
  return status === HTTP_BAD_REQUEST || status === HTTP_BAD_GATEWAY;
}

/** Hasil penilaian test koneksi mode VPN. */
export type VpnApiCheck = {
  status: "passed" | "failed";
  message: string;
};

/**
 * Menyalakan/mematikan mode VPN. Kredensial selalu dikosongkan: saat nyala
 * diisi draft (nilai publik lama ditolak whitelist rute draft), saat mati
 * kredensial VPN tidak berlaku untuk IP publik.
 */
export function applyVpnMode<T extends MikrotikVpnFormFields>(
  form: T,
  isVpn: boolean,
  serverIds: string[],
): T {
  return {
    ...form,
    connectionMode: isVpn ? "VPN" : "PUBLIC",
    vpnServerIds: isVpn ? serverIds : [],
    vpnDraftId: undefined,
    ipAddress: "",
    apiPort: VPN_API_PORT,
    apiUsername: "",
    apiPassword: "",
  };
}

/** Mengganti versi RouterOS; mematikan v7 ikut mematikan mode VPN. */
export function applyRosVersion<T extends MikrotikVpnFormFields>(
  form: T,
  isV7: boolean,
): T {
  const next = { ...form, rosVersion: isV7 ? "V7" : "V6" } as T;
  if (isV7 || next.connectionMode !== "VPN") return next;
  return applyVpnMode(next, false, []);
}

/** Mengisi form dengan alamat tunnel dan kredensial API dari draft. */
export function applyVpnDraft<T extends MikrotikVpnFormFields>(
  form: T,
  draft: VpnDraft,
): T {
  return {
    ...form,
    vpnDraftId: draft.draftId,
    ipAddress: draft.address,
    apiPort: VPN_API_PORT,
    apiUsername: draft.apiUsername,
    apiPassword: draft.apiPassword,
  };
}

/** Menilai test koneksi mode VPN: API harus tersambung dan RouterOS minimal v7. */
export function evaluateVpnConnectionTest(
  result: MikrotikTestConnectionResult,
): VpnApiCheck {
  if (!result.success) {
    return {
      status: "failed",
      message: result.api?.message || result.message || "Koneksi API gagal",
    };
  }
  // "7.16.2 (stable)" → 7; versi tak terbaca dianggap belum terbukti v7.
  const major = Number.parseInt(result.routerInfo?.version ?? "", 10);
  if (!(major >= MIN_VPN_ROUTEROS_MAJOR)) {
    return { status: "failed", message: VPN_ROUTEROS_VERSION_ERROR };
  }
  return { status: "passed", message: "API tersambung" };
}
