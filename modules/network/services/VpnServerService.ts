import { logger } from "@/lib/logger";
import type { IVpnServerRepository } from "../domain/ports/IVpnServerRepository";
import { getVpnCoreClient, VpnCoreError } from "../vpn/VpnCoreClient";
import { VpnServerInUseError, VpnServerUnknownError } from "../vpn/errors";
import type { CoreAdminPeer, CoreHub } from "../vpn/types";

const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const DEFAULT_LISTEN_PORT = 51821;

/** Hub core ditambah jumlah tenant yang memakainya. */
export type VpnServerView = CoreHub & { tenantCount: number };

/** Logika bisnis superadmin untuk server VPN, assignment tenant, dan peer admin. */
export class VpnServerService {
  constructor(private readonly repo: IVpnServerRepository) {}

  /** Daftar hub dari core; setiap hub di-upsert ke database lokal. */
  async listServers(): Promise<VpnServerView[]> {
    const hubs = await getVpnCoreClient().listHubs();
    await Promise.all(hubs.map((hub) => this.repo.upsertHub(hub)));
    const counts = await this.repo.tenantCounts();
    return hubs.map((hub) => ({
      ...hub,
      tenantCount: counts.get(hub.id) ?? 0,
    }));
  }

  /** Membuat hub di core lalu menyimpannya; core di-rollback bila simpan gagal. */
  async createServer(input: {
    name: string;
    publicHost: string;
    listenPort?: number;
  }): Promise<{ server: VpnServerView; installCommand: string }> {
    const core = getVpnCoreClient();
    const { hub, installCommand } = await core.createHub({
      ...input,
      listenPort: input.listenPort ?? DEFAULT_LISTEN_PORT,
    });
    try {
      await this.repo.upsertHub(hub);
    } catch (error) {
      await core.deleteHub(hub.id).catch((rollbackError: unknown) => {
        logger.error("[VPN_SERVER] rollback hub gagal", rollbackError);
      });
      throw error;
    }
    return { server: { ...hub, tenantCount: 0 }, installCommand };
  }

  /** Menghapus server; ditolak bila masih dipakai router. */
  async deleteServer(id: string): Promise<void> {
    const routers = await this.repo.routersUsing([id]);
    if (routers.length > 0) throw new VpnServerInUseError(routers);
    try {
      await getVpnCoreClient().deleteHub(id);
    } catch (error) {
      if (error instanceof VpnCoreError && error.status === HTTP_CONFLICT) {
        throw new VpnServerInUseError([]);
      }
      if (!(error instanceof VpnCoreError && error.status === HTTP_NOT_FOUND)) {
        throw error;
      }
    }
    await this.repo.deleteServer(id);
  }

  /** Menerbitkan ulang perintah instalasi hub. */
  reissue(id: string): Promise<{ installCommand: string }> {
    return getVpnCoreClient().reissueHub(id);
  }

  /** Perintah upgrade hub. */
  upgradeCommand(id: string): Promise<string> {
    return getVpnCoreClient().hubUpgradeCommand(id);
  }

  /** Id server VPN yang diizinkan untuk tenant. */
  getTenantServerIds(tenantId: string): Promise<string[]> {
    return this.repo.tenantServerIds(tenantId);
  }

  /** Mengganti server VPN tenant; menolak mencabut server yang dipakai routernya. */
  async setTenantServers(tenantId: string, ids: string[]): Promise<void> {
    if (ids.length > 0 && (await this.repo.countExisting(ids)) !== ids.length) {
      throw new VpnServerUnknownError();
    }
    const current = await this.repo.tenantServerIds(tenantId);
    const removed = current.filter((id) => !ids.includes(id));
    if (removed.length > 0) {
      const routers = await this.repo.routersUsing(removed, tenantId);
      if (routers.length > 0) throw new VpnServerInUseError(routers);
    }
    await this.repo.replaceTenantServers(tenantId, ids);
  }

  /** Daftar peer admin dari core. */
  listAdminPeers(): Promise<CoreAdminPeer[]> {
    return getVpnCoreClient().listAdminPeers();
  }

  /** Membuat peer admin. */
  createAdminPeer(label: string): Promise<CoreAdminPeer> {
    return getVpnCoreClient().createAdminPeer(label);
  }

  /** Menghapus peer admin. */
  deleteAdminPeer(id: string): Promise<void> {
    return getVpnCoreClient().deleteAdminPeer(id);
  }

  /** Konfigurasi wg-quick peer admin. */
  adminPeerConfig(id: string): Promise<string> {
    return getVpnCoreClient().adminPeerConfig(id);
  }
}
