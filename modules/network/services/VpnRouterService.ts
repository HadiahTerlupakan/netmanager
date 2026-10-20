import { logger } from "@/lib/logger";
import type {
  IMikroTikRouterVpnRepository,
  VpnRouterRecord,
} from "../domain/ports/IMikroTikRouterVpnRepository";
import type { IVpnServerRepository } from "../domain/ports/IVpnServerRepository";
import {
  VpnRouterInvalidError,
  VpnRouterUnreachableError,
  VpnServerNotAvailableError,
} from "../vpn/errors";
import { getVpnCoreClient } from "../vpn/VpnCoreClient";
import { RouterNotFoundError } from "./mikrotik-router.access";
import {
  setPeerEndpoint,
  setSwitchScript,
  withVpnRouterConnection,
  type VpnPeerEndpoint,
} from "./mikrotik-vpn-routeros";

const SERVER_STATUS_ONLINE = "online";
const FIRST_SERVER_PRIORITY = 0;

/** Ringkasan VPN router untuk halaman edit. */
export interface RouterVpnDetail {
  servers: { id: string; name: string; priority: number }[];
  activeServerId: string | null;
  isOnBackup: boolean;
  lastHandshakeAt: string | null;
  events: { fromServerId: string; toServerId: string; at: string }[];
  scriptStale: boolean;
}

/** Penulisan konfigurasi VPN ke router lewat API RouterOS. */
export interface VpnRouterOsWriter {
  writeSwitchScript(router: VpnRouterRecord, source: string): Promise<void>;
  writePeerEndpoint(
    router: VpnRouterRecord,
    endpoint: VpnPeerEndpoint,
  ): Promise<void>;
}

const routerOsWriter: VpnRouterOsWriter = {
  writeSwitchScript: (router, source) =>
    withVpnRouterConnection(router, (conn) => setSwitchScript(conn, source)),
  writePeerEndpoint: (router, endpoint) =>
    withVpnRouterConnection(router, (conn) => setPeerEndpoint(conn, endpoint)),
};

type ActiveVpnRouter = VpnRouterRecord & { vpnCoreRouterId: string };

function toActiveVpnRouter(router: VpnRouterRecord): ActiveVpnRouter | null {
  if (router.connectionMode !== "VPN" || !router.vpnCoreRouterId) return null;
  return { ...router, vpnCoreRouterId: router.vpnCoreRouterId };
}

/** Daftar server, server pertama, dan status VPN untuk router yang sudah tersimpan. */
export class VpnRouterService {
  constructor(
    private readonly repo: IMikroTikRouterVpnRepository,
    private readonly servers: Pick<IVpnServerRepository, "tenantServers">,
    private readonly routerOs: VpnRouterOsWriter = routerOsWriter,
  ) {}

  /** Detail VPN router; sekaligus menyimpan server aktif terbaru dari core. */
  async getRouterVpn(
    routerId: string,
    tenantId: string,
  ): Promise<RouterVpnDetail> {
    const router = await this.requireVpnRouter(routerId, tenantId);
    const [servers, core] = await Promise.all([
      this.repo.listServers(router.id, tenantId),
      getVpnCoreClient().getRouter(router.vpnCoreRouterId),
    ]);
    const activeServerId = core.activeHubId;
    if (activeServerId !== router.vpnActiveServerId) {
      await this.repo.setActiveServer(router.id, tenantId, activeServerId);
    }
    return {
      servers,
      activeServerId,
      isOnBackup:
        activeServerId !== null &&
        servers.length > 0 &&
        activeServerId !== servers[0].id,
      lastHandshakeAt: core.lastHandshakeAt,
      events: core.events.map((e) => ({
        fromServerId: e.fromHubId,
        toServerId: e.toHubId,
        at: e.at,
      })),
      scriptStale: router.vpnScriptStale,
    };
  }

  /**
   * Mengganti daftar server router tanpa tempel ulang. Hub lama yang
   * dikeluarkan tetap di ekor daftar core sampai skrip switch baru sampai di
   * router, sehingga hub aktif tidak pernah hilang. Bila router tak terjangkau,
   * daftar baru tersimpan lokal dengan `scriptStale` dan monitor mengulangnya.
   */
  async updateServers(
    routerId: string,
    tenantId: string,
    serverIds: string[],
  ): Promise<{ scriptStale: boolean }> {
    const router = await this.requireVpnRouter(routerId, tenantId);
    await this.assertServersAvailable(tenantId, serverIds);
    await this.keepRemovedHubsAtTail(router, serverIds);
    await this.repo.replaceServersAsStale(router.id, tenantId, serverIds);
    const isSent = await this.sendSwitchScript(router, tenantId, serverIds);
    return { scriptStale: !isSent };
  }

  /**
   * Mengulang pengiriman skrip switch memakai daftar server lokal. Melempar
   * `VpnCoreError` bila core bermasalah; false bila router masih tak terjangkau.
   */
  async retryStaleScript(
    router: VpnRouterRecord,
    tenantId: string,
  ): Promise<boolean> {
    const vpnRouter = toActiveVpnRouter(router);
    if (!vpnRouter) return false;
    const servers = await this.repo.listServers(router.id, tenantId);
    if (servers.length === 0) return false;
    const desired = servers.map((s) => s.id);
    await this.keepRemovedHubsAtTail(vpnRouter, desired);
    return this.sendSwitchScript(vpnRouter, tenantId, desired);
  }

  /** Mengarahkan peer WireGuard router kembali ke server prioritas pertama. */
  async returnToFirstServer(routerId: string, tenantId: string): Promise<void> {
    const router = await this.requireVpnRouter(routerId, tenantId);
    const endpoint = await this.firstServerEndpoint(router.vpnCoreRouterId);
    try {
      await this.routerOs.writePeerEndpoint(router, endpoint);
    } catch (error) {
      logger.warn(
        `[VPN] Gagal memindah router ${router.id} ke server pertama:`,
        error,
      );
      throw new VpnRouterUnreachableError();
    }
  }

  private async requireVpnRouter(
    routerId: string,
    tenantId: string,
  ): Promise<ActiveVpnRouter> {
    const router = await this.repo.findRouter(routerId, tenantId);
    if (!router) throw new RouterNotFoundError("Router tidak ditemukan");
    const vpnRouter = toActiveVpnRouter(router);
    if (!vpnRouter) {
      throw new VpnRouterInvalidError("Router ini tidak memakai VPN");
    }
    return vpnRouter;
  }

  private async assertServersAvailable(
    tenantId: string,
    serverIds: string[],
  ): Promise<void> {
    const online = new Set(
      (await this.servers.tenantServers(tenantId))
        .filter((s) => s.status === SERVER_STATUS_ONLINE)
        .map((s) => s.id),
    );
    if (!serverIds.every((id) => online.has(id))) {
      throw new VpnServerNotAvailableError();
    }
  }

  private async keepRemovedHubsAtTail(
    router: ActiveVpnRouter,
    desired: string[],
  ): Promise<void> {
    const core = getVpnCoreClient();
    const current = await core.getRouter(router.vpnCoreRouterId);
    const removed = [...current.hubs]
      .sort((a, b) => a.priority - b.priority)
      .map((h) => h.hubId)
      .filter((id) => !desired.includes(id));
    await core.setRouterHubs(router.vpnCoreRouterId, [...desired, ...removed]);
  }

  // Skrip dirender core dari daftar transisi (baru + ekor lama), jadi router
  // hanya kembali ke hub lama bila semua server baru gagal. Daftar final baru
  // dikirim ke core setelah skrip itu sampai di router.
  private async sendSwitchScript(
    router: ActiveVpnRouter,
    tenantId: string,
    desired: string[],
  ): Promise<boolean> {
    const core = getVpnCoreClient();
    const source = await core.routerScript(router.vpnCoreRouterId, "switch");
    try {
      await this.routerOs.writeSwitchScript(router, source);
    } catch (error) {
      logger.warn(
        `[VPN] Skrip switch router ${router.id} belum terkirim:`,
        error,
      );
      return false;
    }
    await core.setRouterHubs(router.vpnCoreRouterId, desired);
    await this.repo.setScriptStale(router.id, tenantId, false);
    return true;
  }

  private async firstServerEndpoint(
    coreRouterId: string,
  ): Promise<VpnPeerEndpoint> {
    const core = getVpnCoreClient();
    const [coreRouter, hubs] = await Promise.all([
      core.getRouter(coreRouterId),
      core.listHubs(),
    ]);
    const first = coreRouter.hubs.find(
      (h) => h.priority === FIRST_SERVER_PRIORITY,
    );
    const hub = first && hubs.find((h) => h.id === first.hubId);
    if (!hub?.publicKey) {
      throw new VpnRouterInvalidError("Server pertama tidak tersedia");
    }
    return {
      host: hub.publicHost,
      port: hub.listenPort,
      publicKey: hub.publicKey,
    };
  }
}
