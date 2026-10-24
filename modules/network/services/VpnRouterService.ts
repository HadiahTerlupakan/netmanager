import { logger } from "@/lib/logger";
import type {
  IMikroTikRouterVpnRepository,
  VpnRouterRecord,
} from "../domain/ports/IMikroTikRouterVpnRepository";
import type { IVpnServerRepository } from "../domain/ports/IVpnServerRepository";
import {
  VpnRouterBusyError,
  VpnRouterInvalidError,
  VpnRouterUnreachableError,
} from "../vpn/errors";
import { toCoreProtocol } from "../vpn/protocol";
import { getVpnCoreClient } from "../vpn/VpnCoreClient";
import { RouterNotFoundError } from "./mikrotik-router.access";
import { assertServersUsable } from "./vpn-server-availability";
import type { CoreFirstServer } from "../vpn/types";
import {
  completeFirstServer,
  setSwitchScript,
  withVpnRouterConnection,
  writeFirstServer,
} from "./mikrotik-vpn-routeros";

const SERVER_LIST_BUSY_MESSAGE =
  "Daftar server router ini sedang diperbarui, coba lagi sebentar";

/** Ringkasan VPN router untuk halaman edit. */
export interface RouterVpnDetail {
  servers: { id: string; name: string; priority: number }[];
  activeServerId: string | null;
  isOnBackup: boolean;
  lastHandshakeAt: string | null;
  events: { fromServerId: string; toServerId: string; at: string }[];
  scriptStale: boolean;
  protocol: VpnRouterRecord["vpnProtocol"];
}

/** Penulisan konfigurasi VPN ke router lewat API RouterOS. */
export interface VpnRouterOsWriter {
  writeSwitchScript(router: VpnRouterRecord, source: string): Promise<void>;
  writeFirstServer(
    router: VpnRouterRecord,
    server: CoreFirstServer,
  ): Promise<void>;
}

const routerOsWriter: VpnRouterOsWriter = {
  writeSwitchScript: (router, source) =>
    withVpnRouterConnection(router, (conn) => setSwitchScript(conn, source)),
  writeFirstServer,
};

/** Router mode VPN yang sudah terdaftar di core. */
export type ActiveVpnRouter = VpnRouterRecord & { vpnCoreRouterId: string };

function toActiveVpnRouter(router: VpnRouterRecord): ActiveVpnRouter | null {
  if (router.connectionMode !== "VPN" || !router.vpnCoreRouterId) return null;
  return { ...router, vpnCoreRouterId: router.vpnCoreRouterId };
}

/**
 * Router VPN milik tenant. Melempar `RouterNotFoundError` bila tidak ada dan
 * `VpnRouterInvalidError` bila router tidak memakai VPN.
 */
export async function requireActiveVpnRouter(
  repo: Pick<IMikroTikRouterVpnRepository, "findRouter">,
  routerId: string,
  tenantId: string,
): Promise<ActiveVpnRouter> {
  const router = await repo.findRouter(routerId, tenantId);
  if (!router) throw new RouterNotFoundError("Router tidak ditemukan");
  const vpnRouter = toActiveVpnRouter(router);
  if (!vpnRouter) {
    throw new VpnRouterInvalidError("Router ini tidak memakai VPN");
  }
  return vpnRouter;
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
    const router = await requireActiveVpnRouter(this.repo, routerId, tenantId);
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
      protocol: router.vpnProtocol,
    };
  }

  /**
   * Mengganti daftar server router tanpa tempel ulang. Hub lama yang
   * dikeluarkan tetap di ekor daftar core sampai skrip switch baru sampai di
   * router, sehingga hub aktif tidak pernah hilang. Bila router tak terjangkau,
   * daftar baru tersimpan lokal dengan `scriptStale` dan monitor mengulangnya.
   * Melempar `VpnRouterBusyError` tanpa menulis apa pun bila pengiriman lain
   * untuk router ini sedang berjalan.
   */
  async updateServers(
    routerId: string,
    tenantId: string,
    serverIds: string[],
  ): Promise<{ scriptStale: boolean }> {
    const router = await requireActiveVpnRouter(this.repo, routerId, tenantId);
    await assertServersUsable(
      this.servers,
      tenantId,
      serverIds,
      toCoreProtocol(router.vpnProtocol),
    );
    const result = await this.repo.withServerListLock(
      router.id,
      async (deadline) => {
        await this.keepRemovedHubsAtTail(router, serverIds);
        await this.repo.replaceServersAsStale(router.id, tenantId, serverIds);
        return this.sendSwitchScript(router, tenantId, serverIds, deadline);
      },
    );
    if (!result.acquired)
      throw new VpnRouterBusyError(SERVER_LIST_BUSY_MESSAGE);
    return { scriptStale: !result.value };
  }

  /**
   * Mengulang pengiriman skrip switch memakai daftar server lokal. Melempar
   * `VpnCoreError` bila core bermasalah; false bila router masih tak terjangkau
   * atau pengiriman lain sedang berjalan (tetap stale untuk siklus berikutnya).
   */
  async retryStaleScript(
    router: VpnRouterRecord,
    tenantId: string,
  ): Promise<boolean> {
    const vpnRouter = toActiveVpnRouter(router);
    if (!vpnRouter) return false;
    const result = await this.repo.withServerListLock(
      router.id,
      async (deadline) => {
        const servers = await this.repo.listServers(router.id, tenantId);
        if (servers.length === 0) return false;
        const desired = servers.map((s) => s.id);
        await this.keepRemovedHubsAtTail(vpnRouter, desired);
        return this.sendSwitchScript(vpnRouter, tenantId, desired, deadline);
      },
    );
    return result.acquired && result.value;
  }

  /** Mengarahkan tunnel router kembali ke server prioritas pertama, per protokol. */
  async returnToFirstServer(routerId: string, tenantId: string): Promise<void> {
    const router = await requireActiveVpnRouter(this.repo, routerId, tenantId);
    const server = await getVpnCoreClient().firstServer(router.vpnCoreRouterId);
    if (!completeFirstServer(server)) {
      throw new VpnRouterInvalidError("Server pertama tidak tersedia");
    }
    try {
      await this.routerOs.writeFirstServer(router, server);
    } catch (error) {
      logger.warn(
        `[VPN] Gagal memindah router ${router.id} ke server pertama:`,
        error,
      );
      throw new VpnRouterUnreachableError();
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
  // dikirim ke core setelah skrip itu sampai di router, dan hanya bila daftar
  // lokal belum diganti request lain (retry monitor vs PUT, atau dua PUT);
  // yang kalah membiarkan skrip stale agar monitor mengirim daftar terbaru.
  // Lewat `deadline` kunci router bisa lepas sebelum CAS selesai, jadi skrip
  // dibiarkan stale dan monitor mengirim ulang di bawah kunci baru.
  private async sendSwitchScript(
    router: ActiveVpnRouter,
    tenantId: string,
    desired: string[],
    deadline: number,
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
    if (Date.now() > deadline) {
      logger.warn(
        `[VPN] Skrip switch router ${router.id} terkirim melewati tenggat kunci; dibiarkan stale`,
      );
      return false;
    }
    return this.repo.completeScriptSend(
      router.id,
      tenantId,
      desired,
      async () => {
        await core.setRouterHubs(router.vpnCoreRouterId, desired);
      },
    );
  }
}
