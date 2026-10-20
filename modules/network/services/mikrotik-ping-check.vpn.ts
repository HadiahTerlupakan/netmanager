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

/**
 * Bedakan tunnel putus dari router mati untuk router VPN yang gagal API: handshake
 * core lebih tua dari batas segar berarti `tunnel_down`. Router publik, VPN
 * belum dikonfigurasi, atau core bermasalah tetap `offline`.
 */
export async function resolveFailedRouterStatus(
  router: {
    id: string;
    connectionMode: string;
    vpnCoreRouterId: string | null;
  },
  breaker: CoreLookupBreaker,
): Promise<FailedRouterStatus> {
  if (router.connectionMode !== "VPN" || !router.vpnCoreRouterId) {
    return "offline";
  }
  if (breaker.isTripped || !isVpnConfigured()) return "offline";
  try {
    const core = await getVpnCoreClient().getRouter(router.vpnCoreRouterId);
    return isHandshakeStale(core.lastHandshakeAt) ? "tunnel_down" : "offline";
  } catch (error) {
    breaker.isTripped = true;
    logger.warn(
      `[VPN] Status tunnel router ${router.id} tidak terbaca:`,
      error,
    );
    return "offline";
  }
}
