import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IMikroTikRouterVpnRepository,
  RouterVpnServerEntry,
  VpnRouterRecord,
} from "../domain/ports/IMikroTikRouterVpnRepository";

const VPN_ROUTER_SELECT = {
  id: true,
  connectionMode: true,
  vpnCoreRouterId: true,
  vpnActiveServerId: true,
  vpnScriptStale: true,
  ipAddress: true,
  apiPort: true,
  apiUsername: true,
  apiPassword: true,
  apiUsernameGenerated: true,
  apiPasswordGenerated: true,
} as const;

const PING_STATUS_ONLINE = "online";

/** Akses database untuk kolom dan daftar server VPN router, selalu disaring tenant. */
export class MikroTikRouterVpnRepository implements IMikroTikRouterVpnRepository {
  constructor(private client: PrismaClient = prisma) {}

  /** Router milik tenant, atau null. */
  findRouter(id: string, tenantId: string): Promise<VpnRouterRecord | null> {
    return this.client.mikroTikRouter.findFirst({
      where: { id, tenantId },
      select: VPN_ROUTER_SELECT,
    });
  }

  /** Daftar server router menurut prioritas. */
  async listServers(
    routerId: string,
    tenantId: string,
  ): Promise<RouterVpnServerEntry[]> {
    const rows = await this.client.mikroTikRouterVpnServer.findMany({
      where: { routerId, router: { tenantId } },
      orderBy: { priority: "asc" },
      select: {
        priority: true,
        vpnServer: { select: { id: true, name: true } },
      },
    });
    return rows.map((r) => ({ ...r.vpnServer, priority: r.priority }));
  }

  /**
   * Mengganti daftar server router dan menandai skripnya belum terkirim dalam
   * satu transaksi. Tidak menulis apa pun bila router bukan milik tenant.
   */
  async replaceServersAsStale(
    routerId: string,
    tenantId: string,
    serverIds: string[],
  ): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const updated = await tx.mikroTikRouter.updateMany({
        where: { id: routerId, tenantId },
        data: { vpnScriptStale: true },
      });
      if (updated.count === 0) return;
      await tx.mikroTikRouterVpnServer.deleteMany({ where: { routerId } });
      await tx.mikroTikRouterVpnServer.createMany({
        data: serverIds.map((vpnServerId, priority) => ({
          routerId,
          vpnServerId,
          priority,
        })),
      });
    });
  }

  /** Menandai skrip switch router sudah/belum terkirim. */
  async setScriptStale(
    routerId: string,
    tenantId: string,
    isStale: boolean,
  ): Promise<void> {
    await this.client.mikroTikRouter.updateMany({
      where: { id: routerId, tenantId },
      data: { vpnScriptStale: isStale },
    });
  }

  /** Menyimpan server VPN yang sedang dipakai router. */
  async setActiveServer(
    routerId: string,
    tenantId: string,
    serverId: string | null,
  ): Promise<void> {
    await this.client.mikroTikRouter.updateMany({
      where: { id: routerId, tenantId },
      data: { vpnActiveServerId: serverId },
    });
  }

  /** Router VPN online yang skripnya belum terkirim, paling lama dulu. */
  findStaleOnline(tenantId: string, limit: number): Promise<VpnRouterRecord[]> {
    return this.client.mikroTikRouter.findMany({
      where: {
        tenantId,
        connectionMode: "VPN",
        vpnCoreRouterId: { not: null },
        vpnScriptStale: true,
        pingStatus: PING_STATUS_ONLINE,
      },
      orderBy: { updatedAt: "asc" },
      take: limit,
      select: VPN_ROUTER_SELECT,
    });
  }
}
