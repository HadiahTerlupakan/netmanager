import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IVpnServerRepository,
  VpnServerSummary,
} from "../domain/ports/IVpnServerRepository";
import type { CoreHub } from "../vpn/types";
import type { VpnServerRouterUsage } from "../vpn/errors";

function hubFields(hub: CoreHub) {
  return {
    name: hub.name,
    publicHost: hub.publicHost,
    listenPort: hub.listenPort,
    status: hub.status,
    lastSeenAt: hub.lastSeenAt ? new Date(hub.lastSeenAt) : null,
  };
}

/** Akses database untuk server VPN, assignment tenant, dan pemakaian router. */
export class VpnServerRepository implements IVpnServerRepository {
  constructor(private client: PrismaClient = prisma) {}

  /** Menyimpan hub dari core; baris yang ada diperbarui. */
  async upsertHub(hub: CoreHub): Promise<void> {
    await this.client.vpnServer.upsert({
      where: { id: hub.id },
      create: { id: hub.id, ...hubFields(hub) },
      update: hubFields(hub),
    });
  }

  /** Jumlah tenant per id server VPN. */
  async tenantCounts(): Promise<Map<string, number>> {
    const rows = await this.client.tenantVpnServer.groupBy({
      by: ["vpnServerId"],
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.vpnServerId, r._count._all]));
  }

  /** Router (beserta nama tenant) yang memakai salah satu server; dibatasi tenant bila diberikan. */
  async routersUsing(
    serverIds: string[],
    tenantId?: string,
  ): Promise<VpnServerRouterUsage[]> {
    const links = await this.client.mikroTikRouterVpnServer.findMany({
      where: {
        vpnServerId: { in: serverIds },
        ...(tenantId ? { router: { tenantId } } : {}),
      },
      select: { router: { select: { id: true, name: true, tenantId: true } } },
    });
    const routers = new Map(links.map((l) => [l.router.id, l.router]));
    const tenants = await this.client.tenant.findMany({
      where: {
        id: { in: [...new Set([...routers.values()].map((r) => r.tenantId))] },
      },
      select: { id: true, name: true },
    });
    const tenantNames = new Map(tenants.map((t) => [t.id, t.name]));
    return [...routers.values()].map((r) => ({
      id: r.id,
      name: r.name,
      tenantName: tenantNames.get(r.tenantId) ?? "",
    }));
  }

  /** Menghapus server beserta assignment tenant-nya dalam satu transaksi. */
  async deleteServer(id: string): Promise<void> {
    await this.client.$transaction([
      this.client.tenantVpnServer.deleteMany({ where: { vpnServerId: id } }),
      this.client.vpnServer.deleteMany({ where: { id } }),
    ]);
  }

  /** Id server VPN yang diizinkan untuk tenant. */
  async tenantServerIds(tenantId: string): Promise<string[]> {
    const rows = await this.client.tenantVpnServer.findMany({
      where: { tenantId },
      select: { vpnServerId: true },
    });
    return rows.map((r) => r.vpnServerId);
  }

  /** Banyaknya id yang benar-benar ada sebagai server VPN. */
  countExisting(ids: string[]): Promise<number> {
    return this.client.vpnServer.count({ where: { id: { in: ids } } });
  }

  /** Mengganti seluruh assignment server VPN sebuah tenant. */
  async replaceTenantServers(tenantId: string, ids: string[]): Promise<void> {
    await this.client.$transaction([
      this.client.tenantVpnServer.deleteMany({ where: { tenantId } }),
      this.client.tenantVpnServer.createMany({
        data: ids.map((vpnServerId) => ({ tenantId, vpnServerId })),
      }),
    ]);
  }

  /** Server VPN yang di-assign ke tenant beserta statusnya. */
  async tenantServers(tenantId: string): Promise<VpnServerSummary[]> {
    const rows = await this.client.tenantVpnServer.findMany({
      where: { tenantId },
      select: {
        vpnServer: {
          select: { id: true, name: true, publicHost: true, status: true },
        },
      },
    });
    return rows.map((r) => r.vpnServer);
  }

  /**
   * Menambahkan server di prioritas max+1 pada router VPN tenant yang belum
   * memakainya. Baris router dikunci lebih dulu (urut id, tanpa mengubah
   * kolomnya) sehingga `replaceServersAsStale` dan `completeScriptSend` yang
   * bersamaan antre di belakang transaksi ini; pengiriman yang sedang jalan
   * kalah pada compare-and-set dan router tetap stale untuk dikirim ulang
   * monitor.
   */
  async appendServerToTenantRouters(
    tenantId: string,
    serverId: string,
  ): Promise<number> {
    return this.client.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "MikroTikRouter"
        WHERE "tenantId" = ${tenantId}
          AND "connectionMode" = 'VPN'
          AND "vpnCoreRouterId" IS NOT NULL
        ORDER BY "id"
        FOR UPDATE`;
      const routerIds = locked.map((r) => r.id);
      const links = await tx.mikroTikRouterVpnServer.findMany({
        where: { routerId: { in: routerIds }, router: { tenantId } },
        select: { routerId: true, vpnServerId: true, priority: true },
      });
      const nextPriority = new Map<string, number>();
      const hasServer = new Set<string>();
      for (const link of links) {
        nextPriority.set(
          link.routerId,
          Math.max(nextPriority.get(link.routerId) ?? 0, link.priority + 1),
        );
        if (link.vpnServerId === serverId) hasServer.add(link.routerId);
      }
      const changed = routerIds.filter((id) => !hasServer.has(id));
      if (changed.length === 0) return 0;
      await tx.mikroTikRouterVpnServer.createMany({
        data: changed.map((routerId) => ({
          routerId,
          vpnServerId: serverId,
          priority: nextPriority.get(routerId) ?? 0,
        })),
      });
      await tx.mikroTikRouter.updateMany({
        where: { id: { in: changed }, tenantId },
        data: { vpnScriptStale: true },
      });
      return changed.length;
    });
  }
}
