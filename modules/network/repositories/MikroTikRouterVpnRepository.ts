import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { VPN_CORE_TIMEOUT_MS } from "../vpn/VpnCoreClient";
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
// Transaksi menahan kunci baris selama satu PUT ke core (dibatasi
// VPN_CORE_TIMEOUT_MS); sisanya untuk query di dalam transaksi.
const SCRIPT_SEND_TX_TIMEOUT_MS = VPN_CORE_TIMEOUT_MS * 2;

function isSameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

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

  /**
   * Compare-and-set penyelesaian skrip switch. Baris router dikunci lebih dulu
   * (update yang menandai stale), sehingga `replaceServersAsStale` yang
   * bersamaan menunggu sampai transaksi ini selesai dan `finalize` (PUT final
   * ke core) tidak pernah menimpa daftar yang lebih baru.
   */
  completeScriptSend(
    routerId: string,
    tenantId: string,
    sentServerIds: string[],
    finalize: () => Promise<void>,
  ): Promise<boolean> {
    return this.client.$transaction(
      async (tx) => {
        const locked = await tx.mikroTikRouter.updateMany({
          where: { id: routerId, tenantId },
          data: { vpnScriptStale: true },
        });
        if (locked.count === 0) return false;
        const rows = await tx.mikroTikRouterVpnServer.findMany({
          where: { routerId },
          orderBy: { priority: "asc" },
          select: { vpnServerId: true },
        });
        if (
          !isSameOrder(
            rows.map((r) => r.vpnServerId),
            sentServerIds,
          )
        ) {
          return false;
        }
        await finalize();
        await tx.mikroTikRouter.updateMany({
          where: { id: routerId, tenantId },
          data: { vpnScriptStale: false },
        });
        return true;
      },
      { timeout: SCRIPT_SEND_TX_TIMEOUT_MS },
    );
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
