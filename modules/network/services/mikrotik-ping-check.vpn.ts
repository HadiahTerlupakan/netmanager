import { logger } from "@/lib/logger";
import { getVpnCoreClient, isVpnConfigured } from "../vpn/VpnCoreClient";
import { VPN_HANDSHAKE_FRESH_MS } from "./VpnDraftService";

/** Status router yang API-nya gagal dijawab. */
export type FailedRouterStatus = "offline" | "tunnel_down";

/** Pemutus lookup core per siklus: setelah galat pertama core tidak ditanya lagi. */
export interface CoreLookupBreaker {
  isTripped: boolean;
}

/** Pemutus baru untuk satu siklus pemeriksaan. */
export function createCoreLookupBreaker(): CoreLookupBreaker {
  return { isTripped: false };
}

function isHandshakeStale(lastHandshakeAt: string | null): boolean {
  if (!lastHandshakeAt) return true;
  return Date.now() - Date.parse(lastHandshakeAt) > VPN_HANDSHAKE_FRESH_MS;
}

/** Hasil lookup core untuk satu router VPN pada satu siklus pemeriksaan. */
export interface VpnRouterLookup {
  /** Status bila API router gagal dijawab. */
  failedStatus: FailedRouterStatus;
  /** Server yang sedang dipakai router; `undefined` bila core tidak ditanya atau galat. */
  activeServerId?: string | null;
}

/**
 * Tanya core sekali untuk router VPN: handshake yang lebih tua dari batas segar
 * berarti `tunnel_down` (dipakai bila API gagal), dan `activeHubId` menjadi
 * server aktif. Router publik, VPN belum dikonfigurasi, pemutus terpicu, atau
 * core bermasalah memberi `offline` tanpa server aktif.
 */
export async function lookupVpnRouter(
  router: {
    id: string;
    connectionMode: string;
    vpnCoreRouterId: string | null;
  },
  breaker: CoreLookupBreaker,
): Promise<VpnRouterLookup> {
  if (router.connectionMode !== "VPN" || !router.vpnCoreRouterId) {
    return { failedStatus: "offline" };
  }
  if (breaker.isTripped || !isVpnConfigured()) {
    return { failedStatus: "offline" };
  }
  try {
    const core = await getVpnCoreClient().getRouter(router.vpnCoreRouterId);
    return {
      failedStatus: isHandshakeStale(core.lastHandshakeAt)
        ? "tunnel_down"
        : "offline",
      activeServerId: core.activeHubId,
    };
  } catch (error) {
    breaker.isTripped = true;
    logger.warn(
      `[VPN] Status tunnel router ${router.id} tidak terbaca:`,
      error,
    );
    return { failedStatus: "offline" };
  }
}
