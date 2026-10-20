import { logger } from "@/lib/logger";
import type {
  CoreAdminPeer,
  CoreHub,
  CoreRouter,
  RouterScriptPart,
} from "./types";

/** Batas waktu satu panggilan ke API core. */
export const VPN_CORE_TIMEOUT_MS = 5000;
const IPV4_DOTTED_QUAD =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const DEFAULT_VPN_CORE_ADDRESS = "10.99.0.1";
const HTTP_BAD_GATEWAY = 502;
const HTTP_GATEWAY_TIMEOUT = 504;

/** Galat dari API core; `code` adalah field `error` pada body core. */
export class VpnCoreError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VpnCoreError";
  }
}

/** True bila URL dan token API core sudah diisi. */
export function isVpnConfigured(): boolean {
  return Boolean(process.env.VPN_CORE_API_URL && process.env.VPN_API_TOKEN);
}

/** Alamat WireGuard core di dalam overlay, tujuan tunnel router. */
export function getVpnCoreAddress(): string {
  const configured = process.env.VPN_CORE_ADDRESS;
  if (!configured) return DEFAULT_VPN_CORE_ADDRESS;
  if (IPV4_DOTTED_QUAD.test(configured)) return configured;
  logger.warn("[VPN] VPN_CORE_ADDRESS bukan IPv4 valid, memakai default");
  return DEFAULT_VPN_CORE_ADDRESS;
}

async function toCoreError(res: Response): Promise<VpnCoreError> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    const code = body.error || "internal";
    return new VpnCoreError(res.status, code, body.message ?? code);
  } catch {
    return new VpnCoreError(res.status, "internal");
  }
}

function abortError(): DOMException {
  return new DOMException("aborted", "AbortError");
}

// Abort hanya membatalkan fetch dan body milik fetch asli; body yang macet di
// luar itu tetap harus diputus oleh sinyal yang sama.
function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

function toTransportError(err: unknown): VpnCoreError {
  if (err instanceof VpnCoreError) return err;
  if (err instanceof Error && err.name === "AbortError") {
    return new VpnCoreError(
      HTTP_GATEWAY_TIMEOUT,
      "timeout",
      "Core VPN tidak merespons",
    );
  }
  if (err instanceof SyntaxError) {
    return new VpnCoreError(
      HTTP_BAD_GATEWAY,
      "internal",
      "Respons core VPN tidak valid",
    );
  }
  return new VpnCoreError(
    HTTP_BAD_GATEWAY,
    "unreachable",
    "Core VPN tidak terjangkau",
  );
}

/**
 * Satu panggilan ke core, termasuk membaca body lewat `read`, seluruhnya di
 * dalam `VPN_CORE_TIMEOUT_MS`.
 */
async function send<T>(
  method: string,
  path: string,
  read: (res: Response) => Promise<T>,
  body?: unknown,
): Promise<T> {
  const base = (process.env.VPN_CORE_API_URL ?? "").replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VPN_CORE_TIMEOUT_MS);
  const call = async (): Promise<T> => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.VPN_API_TOKEN ?? ""}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw await toCoreError(res);
    return read(res);
  };
  try {
    return await untilAborted(call(), controller.signal);
  } catch (err) {
    throw toTransportError(err);
  } finally {
    clearTimeout(timer);
  }
}

function json<T>(method: string, path: string, body?: unknown): Promise<T> {
  return send(method, path, (res) => res.json() as Promise<T>, body);
}

function text(path: string): Promise<string> {
  return send("GET", path, (res) => res.text());
}

async function remove(path: string): Promise<void> {
  await send("DELETE", path, async (): Promise<void> => {});
}

/** Klien HTTP untuk API core netmanager-vpn. */
export class VpnCoreClient {
  /** Daftar hub. */
  listHubs(): Promise<CoreHub[]> {
    return json("GET", "/v1/hubs");
  }

  /** Membuat hub dan perintah instalasinya. */
  createHub(input: {
    name: string;
    publicHost: string;
    listenPort: number;
  }): Promise<{ hub: CoreHub; installCommand: string }> {
    return json("POST", "/v1/hubs", input);
  }

  /** Menerbitkan ulang perintah instalasi hub. */
  reissueHub(id: string): Promise<{ installCommand: string }> {
    return json("POST", `/v1/hubs/${encodeURIComponent(id)}/reissue`);
  }

  /** Perintah upgrade hub (teks). */
  hubUpgradeCommand(id: string): Promise<string> {
    return text(`/v1/hubs/${encodeURIComponent(id)}/upgrade-command`);
  }

  /** Menghapus hub. */
  deleteHub(id: string): Promise<void> {
    return remove(`/v1/hubs/${encodeURIComponent(id)}`);
  }

  /** Membuat router VPN pada hub yang dipilih. */
  createRouter(input: {
    label: string;
    hubIds: string[];
  }): Promise<CoreRouter> {
    return json("POST", "/v1/routers", input);
  }

  /** Mengambil satu router. */
  getRouter(id: string): Promise<CoreRouter> {
    return json("GET", `/v1/routers/${encodeURIComponent(id)}`);
  }

  /** Mengganti daftar hub sebuah router. */
  setRouterHubs(id: string, hubIds: string[]): Promise<CoreRouter> {
    return json("PUT", `/v1/routers/${encodeURIComponent(id)}/hubs`, {
      hubIds,
    });
  }

  /** Mengaitkan router dengan referensi (id router di netmanager). */
  claimRouter(id: string, ref: string): Promise<CoreRouter> {
    return json("POST", `/v1/routers/${encodeURIComponent(id)}/claim`, { ref });
  }

  /** Menghapus router. */
  deleteRouter(id: string): Promise<void> {
    return remove(`/v1/routers/${encodeURIComponent(id)}`);
  }

  /** Skrip RouterOS (teks) untuk bagian yang diminta. */
  routerScript(id: string, part: RouterScriptPart): Promise<string> {
    return text(`/v1/routers/${encodeURIComponent(id)}/routeros?part=${part}`);
  }

  /** Daftar peer admin. */
  listAdminPeers(): Promise<CoreAdminPeer[]> {
    return json("GET", "/v1/admin-peers");
  }

  /** Membuat peer admin. */
  createAdminPeer(label: string): Promise<CoreAdminPeer> {
    return json("POST", "/v1/admin-peers", { label });
  }

  /** Menghapus peer admin. */
  deleteAdminPeer(id: string): Promise<void> {
    return remove(`/v1/admin-peers/${encodeURIComponent(id)}`);
  }

  /** Konfigurasi WireGuard (teks) untuk peer admin. */
  adminPeerConfig(id: string): Promise<string> {
    return text(`/v1/admin-peers/${encodeURIComponent(id)}/config`);
  }
}

/** Klien baru; env dibaca saat panggilan sehingga tes bisa mengubahnya. */
export function getVpnCoreClient(): VpnCoreClient {
  return new VpnCoreClient();
}
