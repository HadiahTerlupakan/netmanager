import type { NetworkRepository } from "../repositories/NetworkRepository";
import type { MikroTikPPPSecretService } from "./MikroTikPPPSecretService";
import { toMB } from "./radius-sync-session.helpers";

const BYTES_PER_MB = 1048576;
const ROUTER_NOT_FOUND_ERROR = "Router tenant tidak ditemukan";

export type RadiusSyncDisconnectErrorCode =
  | "PELANGGAN_NOT_FOUND"
  | "ROUTER_NOT_FOUND";

export async function resolveRouterForUsername(
  networkRepo: NetworkRepository,
  username: string,
  tenantId: string,
  nasIpAddress?: string,
): Promise<{
  routerId?: string;
  source?: "pelanggan" | "nas-ip" | "tenant-fallback";
}> {
  const pelanggan = await networkRepo.findPelangganWithRouterByUsername(
    username,
    tenantId,
  );
  if (pelanggan?.hargaPaket?.profilePPP?.mikroTikRouter?.id) {
    return {
      routerId: pelanggan.hargaPaket.profilePPP.mikroTikRouter.id,
      source: "pelanggan",
    };
  }

  if (nasIpAddress) {
    const router = await networkRepo.findRouterByNasIp(nasIpAddress, tenantId);
    if (router?.id) {
      return { routerId: router.id, source: "nas-ip" };
    }
  }

  const router = await networkRepo.findAnyRouterByTenant(tenantId);
  if (router?.id) {
    return { routerId: router.id, source: "tenant-fallback" };
  }

  return {};
}

export async function disconnectSessionByUsername(
  networkRepo: NetworkRepository,
  pppSecretService: MikroTikPPPSecretService,
  username: string,
  tenantId: string,
): Promise<{
  success: boolean;
  disconnected: number;
  pelangganId?: string;
  error?: string;
  errorCode?: RadiusSyncDisconnectErrorCode;
}> {
  const pelanggan = await networkRepo.findPelangganWithRouterByUsername(
    username,
    tenantId,
  );

  if (!pelanggan) {
    return {
      success: false,
      disconnected: 0,
      error: "Pelanggan tidak ditemukan untuk tenant ini",
      errorCode: "PELANGGAN_NOT_FOUND",
    };
  }

  const routerId = pelanggan.hargaPaket?.profilePPP?.mikroTikRouter?.id;
  if (!routerId) {
    return {
      success: false,
      disconnected: 0,
      pelangganId: pelanggan.id,
      error: "Router pelanggan tidak ditemukan",
      errorCode: "ROUTER_NOT_FOUND",
    };
  }

  const result = await pppSecretService.disconnectSession(routerId, username);

  return {
    success: result.success,
    disconnected: result.disconnected,
    pelangganId: pelanggan.id,
    ...(result.error ? { error: result.error } : {}),
  };
}

export async function getLiveSessionUsageByUsername(
  networkRepo: NetworkRepository,
  pppSecretService: MikroTikPPPSecretService,
  username: string,
  tenantId: string,
  nasIpAddress?: string,
): Promise<{
  success: boolean;
  routerId?: string;
  routerSource?: "pelanggan" | "nas-ip" | "tenant-fallback";
  downloadMB?: number;
  uploadMB?: number;
  error?: string;
}> {
  const { routerId, source } = await resolveRouterForUsername(
    networkRepo,
    username,
    tenantId,
    nasIpAddress,
  );

  if (!routerId) {
    return {
      success: false,
      error: ROUTER_NOT_FOUND_ERROR,
    };
  }

  const usage = await pppSecretService.getActiveSessionUsage(
    routerId,
    username,
  );
  if (!usage.success || !usage.usage) {
    return {
      success: false,
      routerId,
      routerSource: source,
      ...(usage.error ? { error: usage.error } : {}),
    };
  }

  return {
    success: true,
    routerId,
    routerSource: source,
    uploadMB: toMB(usage.usage.uploadBytes, BYTES_PER_MB),
    downloadMB: toMB(usage.usage.downloadBytes, BYTES_PER_MB),
  };
}

export async function debugLiveSessionUsageByUsername(
  networkRepo: NetworkRepository,
  pppSecretService: MikroTikPPPSecretService,
  username: string,
  tenantId: string,
  nasIpAddress?: string,
): Promise<{
  success: boolean;
  routerSource?: "pelanggan" | "nas-ip" | "tenant-fallback";
  routerId?: string;
  debug?: unknown;
  error?: string;
}> {
  const { routerId, source } = await resolveRouterForUsername(
    networkRepo,
    username,
    tenantId,
    nasIpAddress,
  );

  if (!routerId) {
    return {
      success: false,
      error: ROUTER_NOT_FOUND_ERROR,
    };
  }

  const debug = await pppSecretService.debugActiveSessionUsage(
    routerId,
    username,
  );
  if (!debug.success) {
    return {
      success: false,
      routerSource: source,
      routerId,
      ...(debug.error ? { error: debug.error } : {}),
    };
  }

  return {
    success: true,
    routerSource: source,
    routerId,
    debug,
  };
}
