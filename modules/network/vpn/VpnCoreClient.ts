import type {
  CoreAdminPeer,
  CoreHub,
  CoreRouter,
  RouterScriptPart,
} from "./types";

/** Batas waktu satu panggilan ke API core. */
export const VPN_CORE_TIMEOUT_MS = 5000;
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
  return process.env.VPN_CORE_ADDRESS || DEFAULT_VPN_CORE_ADDRESS;
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

async function send(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const base = (process.env.VPN_CORE_API_URL ?? "").replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VPN_CORE_TIMEOUT_MS);
  try {
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
    return res;
  } catch (err) {
    if (err instanceof VpnCoreError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new VpnCoreError(
        HTTP_GATEWAY_TIMEOUT,
        "timeout",
        "Core VPN tidak merespons",
      );
    }
    throw new VpnCoreError(
      HTTP_BAD_GATEWAY,
      "unreachable",
      "Core VPN tidak terjangkau",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function json<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await send(method, path, body);
  return (await res.json()) as T;
}

async function text(path: string): Promise<string> {
  return (await send("GET", path)).text();
}

async function remove(path: string): Promise<void> {
  await send("DELETE", path);
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
    return json("POST", `/v1/hubs/${id}/reissue`);
  }

  /** Perintah upgrade hub (teks). */
  hubUpgradeCommand(id: string): Promise<string> {
    return text(`/v1/hubs/${id}/upgrade-command`);
  }

  /** Menghapus hub. */
  deleteHub(id: string): Promise<void> {
    return remove(`/v1/hubs/${id}`);
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
    return json("GET", `/v1/routers/${id}`);
  }

  /** Mengganti daftar hub sebuah router. */
  setRouterHubs(id: string, hubIds: string[]): Promise<CoreRouter> {
    return json("PUT", `/v1/routers/${id}/hubs`, { hubIds });
  }

  /** Mengaitkan router dengan referensi (id router di netmanager). */
  claimRouter(id: string, ref: string): Promise<CoreRouter> {
    return json("POST", `/v1/routers/${id}/claim`, { ref });
  }

  /** Menghapus router. */
  deleteRouter(id: string): Promise<void> {
    return remove(`/v1/routers/${id}`);
  }

  /** Skrip RouterOS (teks) untuk bagian yang diminta. */
  routerScript(id: string, part: RouterScriptPart): Promise<string> {
    return text(`/v1/routers/${id}/routeros?part=${part}`);
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
    return remove(`/v1/admin-peers/${id}`);
  }

  /** Konfigurasi WireGuard (teks) untuk peer admin. */
  adminPeerConfig(id: string): Promise<string> {
    return text(`/v1/admin-peers/${id}/config`);
  }
}

/** Klien baru; env dibaca saat panggilan sehingga tes bisa mengubahnya. */
export function getVpnCoreClient(): VpnCoreClient {
  return new VpnCoreClient();
}
