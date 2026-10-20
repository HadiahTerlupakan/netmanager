import type { IVpnCoreRouterTombstoneRepository } from "../domain/ports/IVpnCoreRouterTombstoneRepository";
import type { VpnMigrationRouterRecord } from "../domain/ports/IVpnRouterMigrationRepository";
import type { IVpnServerRepository } from "../domain/ports/IVpnServerRepository";
import {
  VpnDraftInvalidError,
  VpnRouterInvalidError,
  VpnServerNotAvailableError,
} from "../vpn/errors";
import type { CoreRouter } from "../vpn/types";
import type { MikroTikProvisioningRouterDetails } from "./mikrotik-provisioning.connection";
import { RouterNotFoundError } from "./mikrotik-router.access";
import { fetchDraft } from "./mikrotik-router.vpn-create";
import type { VpnMigrationRouterOs } from "./mikrotik-vpn-migration.routeros";
import {
  assertDraftOwned,
  isHandshakeFresh,
  isUnclaimedDraft,
} from "./VpnDraftService";

// Skrip VPN membuka service API RouterOS pada port ini; router yang disimpan
// dengan port lain akan kehilangan akses publiknya begitu skrip ditempel.
const VPN_API_PORT = 8728;
const MIN_ROUTEROS_MAJOR = 7;
const SERVER_STATUS_ONLINE = "online";

/** Router VPN yang bisa dikembalikan ke publik. */
export type RevertableVpnRouter = VpnMigrationRouterRecord & {
  vpnCoreRouterId: string;
  publicIpAddress: string;
};

/** Kredensial API yang dipakai netmanager untuk terhubung ke router. */
export function apiUsernameOf(router: VpnMigrationRouterRecord): string {
  return router.apiUsernameGenerated || router.apiUsername;
}

/** Koneksi API ke router pada `ip` dengan kredensial tersimpannya. */
export function routerApiConnection(
  router: VpnMigrationRouterRecord,
  ip: string,
): MikroTikProvisioningRouterDetails {
  return {
    ip,
    port: router.apiPort,
    username: apiUsernameOf(router),
    password: router.apiPasswordGenerated || router.apiPassword,
  };
}

/** Router ada, masih publik, RouterOS v7, dan port API-nya sesuai skrip VPN. */
export function requirePublicV7Router(
  router: VpnMigrationRouterRecord | null,
): VpnMigrationRouterRecord {
  if (!router) throw new RouterNotFoundError("Router tidak ditemukan");
  if (router.connectionMode !== "PUBLIC") {
    throw new VpnRouterInvalidError("Router ini sudah memakai VPN");
  }
  if (router.rosVersion !== "V7") {
    throw new VpnRouterInvalidError("VPN memerlukan RouterOS v7");
  }
  if (router.apiPort !== VPN_API_PORT) {
    throw new VpnRouterInvalidError(
      `Port API router harus ${VPN_API_PORT} untuk mode VPN`,
    );
  }
  return router;
}

/** Router ada, memakai VPN, dan IP publiknya tersimpan. */
export function requireRevertableRouter(
  router: VpnMigrationRouterRecord | null,
): RevertableVpnRouter {
  if (!router) throw new RouterNotFoundError("Router tidak ditemukan");
  if (router.connectionMode !== "VPN" || !router.vpnCoreRouterId) {
    throw new VpnRouterInvalidError("Router ini tidak memakai VPN");
  }
  if (!router.publicIpAddress) {
    throw new VpnRouterInvalidError("IP publik router tidak diketahui");
  }
  return {
    ...router,
    vpnCoreRouterId: router.vpnCoreRouterId,
    publicIpAddress: router.publicIpAddress,
  };
}

/** Draft milik tenant yang belum dipakai router lain. */
export async function fetchUnclaimedDraft(
  draftId: string,
  tenantId: string,
  tombstones: Pick<IVpnCoreRouterTombstoneRepository, "has">,
): Promise<CoreRouter> {
  const draft = await fetchDraft(draftId, tombstones);
  assertDraftOwned(draft, tenantId);
  if (!isUnclaimedDraft(draft)) {
    throw new VpnDraftInvalidError("Draft VPN sudah dipakai");
  }
  return draft;
}

/** Melempar bila tunnel draft belum melakukan handshake baru-baru ini. */
export function assertTunnelUp(draft: CoreRouter, now: number): void {
  if (!isHandshakeFresh(draft, now)) {
    throw new VpnDraftInvalidError("Tunnel VPN belum tersambung");
  }
}

/** Server yang diminta di-assign ke tenant dan sedang online. */
export async function assertServersOnline(
  servers: Pick<IVpnServerRepository, "tenantServers">,
  tenantId: string,
  serverIds: string[],
): Promise<void> {
  const online = new Set(
    (await servers.tenantServers(tenantId))
      .filter((s) => s.status === SERVER_STATUS_ONLINE)
      .map((s) => s.id),
  );
  if (!serverIds.every((id) => online.has(id))) {
    throw new VpnServerNotAvailableError();
  }
}

/**
 * Login API router lewat `conn` (alamat tunnel) dengan kredensial tersimpan
 * dan pastikan RouterOS minimal v7. Mengembalikan string versi router.
 */
export async function assertTunnelApi(
  routerOs: Pick<VpnMigrationRouterOs, "testApi">,
  conn: MikroTikProvisioningRouterDetails,
): Promise<string> {
  const result = await routerOs.testApi(conn);
  if (!result.success) {
    throw new VpnRouterInvalidError(
      `API router tidak bisa diakses lewat tunnel: ${result.message}`,
    );
  }
  const version = result.routerInfo?.version ?? "";
  // "7.16.2 (stable)" → 7; versi tak terbaca dianggap belum terbukti v7.
  if (!(Number.parseInt(version, 10) >= MIN_ROUTEROS_MAJOR)) {
    throw new VpnRouterInvalidError("Router harus RouterOS v7");
  }
  return version;
}
