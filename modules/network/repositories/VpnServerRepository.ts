import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IVpnServerRepository,
  VpnServerSummary,
} from "../domain/ports/IVpnServerRepository";
import type { CoreHub } from "../vpn/types";
import type { VpnServerRouterUsage } from "../vpn/errors";
import { SCRIPT_SEND_TX_TIMEOUT_MS } from "./MikroTikRouterVpnRepository";

// Core lama belum melaporkan protokol hub dan hanya melayani WireGuard.
const DEFAULT_HUB_PROTOCOLS = ["wireguard"];

function hubFields(hub: CoreHub) {
  return {
    name: hub.name,
    publicHost: hub.publicHost,
    listenPort: hub.listenPort,
    status: hub.status,
    protocols: hub.protocols?.length ? hub.protocols : DEFAULT_HUB_PROTOCOLS,
    lastSeenAt: hub.lastSeenAt ? new Date(hub.lastSeenAt) : null,
  };
}

// Kelonggaran untuk pernyataan detach sendiri di atas tabel tautan yang besar.
const DETACH_QUERY_MARGIN_MS = 20_000;
/**
 * Batas transaksi detach. Mengunci baris semua router pemakai berarti antre di
 * belakang `completeScriptSend` yang bisa menahan kuncinya sampai
 * SCRIPT_SEND_TX_TIMEOUT_MS; batas bawaan Prisma (5 detik) membuat server yang
 * dipakai banyak router selalu rollback (P2028) dan tidak pernah bisa dihapus.
 */
const DETACH_TX_TIMEOUT_MS = SCRIPT_SEND_TX_TIMEOUT_MS + DETACH_QUERY_MARGIN_MS;

interface RouterRef {
  id: string;
  name: string;
  tenantId: string;
}

/** Melengkapi router dengan nama tenant (satu query) untuk pesan pemakaian. */
async function toUsage(
  client: Pick<PrismaClient, "tenant"> | Prisma.TransactionClient,
  routerRefs: RouterRef[],
): Promise<VpnServerRouterUsage[]> {
  const routers = new Map(routerRefs.map((r) => [r.id, r]));
  const tenants = await client.tenant.findMany({
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
    return toUsage(
      this.client,
      links.map((l) => l.router),
    );
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
          select: {
            id: true,
            name: true,
            publicHost: true,
            status: true,
            protocols: true,
          },
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

  /**
   * Mengeluarkan server dari semua router yang memakainya (lintas tenant).
   * Router yang hanya punya server ini dilewati dan dilaporkan; sisanya
   * dikunci (sama seperti `appendServerToTenantRouters`), diberi
   * `vpnScriptStale`, dan prioritas sisa server dirapatkan 0..n-1 sesuai
   * urutan semula.
   */
  async detachServerFromRouters(
    serverId: string,
  ): Promise<{ detached: number; onlyServer: VpnServerRouterUsage[] }> {
    return this.client.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "MikroTikRouter"
        WHERE "id" IN (
          SELECT "routerId" FROM "mikrotik_router_vpn_servers"
          WHERE "vpnServerId" = ${serverId})
        ORDER BY "id"
        FOR UPDATE`;
        const routerIds = locked.map((r) => r.id);
        const links = await tx.mikroTikRouterVpnServer.findMany({
          where: { routerId: { in: routerIds } },
          orderBy: [{ routerId: "asc" }, { priority: "asc" }],
          select: { routerId: true, vpnServerId: true },
        });
        const byRouter = new Map<string, string[]>();
        for (const link of links) {
          byRouter.set(link.routerId, [
            ...(byRouter.get(link.routerId) ?? []),
            link.vpnServerId,
          ]);
        }
        // Daftar dibaca ulang setelah kunci: router yang daftarnya berubah
        // tanpa server ini selagi menunggu kunci tidak disentuh.
        const using = routerIds.filter((id) =>
          byRouter.get(id)?.includes(serverId),
        );
        const only = using.filter((id) => byRouter.get(id)?.length === 1);
        const detach = using.filter((id) => !only.includes(id));
        await removeLinks(tx, detach, serverId);
        await tx.mikroTikRouter.updateMany({
          where: { id: { in: detach } },
          data: { vpnScriptStale: true },
        });
        const onlyRouters = await tx.mikroTikRouter.findMany({
          where: { id: { in: only } },
          select: { id: true, name: true, tenantId: true },
        });
        return {
          detached: detach.length,
          onlyServer: await toUsage(tx, onlyRouters),
        };
      },
      { timeout: DETACH_TX_TIMEOUT_MS },
    );
  }
}

/**
 * Menghapus tautan server dari router-router itu lalu merapatkan prioritas
 * sisanya 0..n-1 sesuai urutan semula, dalam dua pernyataan berapa pun jumlah
 * routernya.
 */
async function removeLinks(
  tx: Prisma.TransactionClient,
  routerIds: string[],
  serverId: string,
): Promise<void> {
  if (routerIds.length === 0) return;
  await tx.mikroTikRouterVpnServer.deleteMany({
    where: { routerId: { in: routerIds }, vpnServerId: serverId },
  });
  await tx.$executeRaw`
    UPDATE "mikrotik_router_vpn_servers" AS l
    SET "priority" = r."priority"
    FROM (
      SELECT "routerId", "vpnServerId",
        (ROW_NUMBER() OVER (
          PARTITION BY "routerId" ORDER BY "priority", "vpnServerId"
        ) - 1)::int AS "priority"
      FROM "mikrotik_router_vpn_servers"
      WHERE "routerId" = ANY(${routerIds})
    ) AS r
    WHERE l."routerId" = r."routerId"
      AND l."vpnServerId" = r."vpnServerId"
      AND l."priority" <> r."priority"`;
}
