import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { VPN_CORE_TIMEOUT_MS } from "../vpn/VpnCoreClient";
import { VPN_ROUTEROS_OP_TIMEOUT_MS } from "../services/mikrotik-vpn-routeros";
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
/**
 * Batas transaksi compare-and-set `completeScriptSend`: kunci baris ditahan
 * selama satu PUT ke core (dibatasi VPN_CORE_TIMEOUT_MS); sisanya untuk query
 * di dalam transaksi.
 */
export const SCRIPT_SEND_TX_TIMEOUT_MS = VPN_CORE_TIMEOUT_MS * 2;
// Panggilan core dalam satu pengiriman: GET router, PUT daftar transisi,
// GET skrip, PUT final.
const CORE_CALLS_PER_SEND = 4;
// Ruang untuk query lokal di luar completeScriptSend (listServers,
// replaceServersAsStale) dan antrean pool.
const SERVER_LIST_LOCK_MARGIN_MS = 15_000;
/**
 * Batas transaksi kunci daftar server: semua panggilan core, satu operasi
 * RouterOS, dan completeScriptSend (yang PUT finalnya ikut terhitung di
 * panggilan core, jadi ini batas atas), ditambah margin.
 */
export const SERVER_LIST_LOCK_TX_TIMEOUT_MS =
  CORE_CALLS_PER_SEND * VPN_CORE_TIMEOUT_MS +
  VPN_ROUTEROS_OP_TIMEOUT_MS +
  SCRIPT_SEND_TX_TIMEOUT_MS +
  SERVER_LIST_LOCK_MARGIN_MS;

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
   * Kunci advisory transaksi per router, hanya dicoba (tidak pernah antre).
   * Hanya kuncinya yang ada di `tx`; `fn` memakai koneksi pool lain, dan kunci
   * lepas saat transaksi berakhir, termasuk saat `fn` melempar. `fn` menerima
   * tenggat (epoch ms) terakhir untuk memulai completeScriptSend agar selesai
   * sebelum transaksi ini kedaluwarsa.
   */
  withServerListLock<T>(
    routerId: string,
    fn: (deadline: number) => Promise<T>,
  ): Promise<{ acquired: true; value: T } | { acquired: false }> {
    return this.client.$transaction(
      async (tx) => {
        const [row] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(
            hashtextextended('vpn-server-list:' || ${routerId}, 0)
          ) AS locked`;
        if (!row?.locked) return { acquired: false as const };
        const deadline =
          Date.now() +
          SERVER_LIST_LOCK_TX_TIMEOUT_MS -
          SCRIPT_SEND_TX_TIMEOUT_MS;
        return { acquired: true as const, value: await fn(deadline) };
      },
      { timeout: SERVER_LIST_LOCK_TX_TIMEOUT_MS },
    );
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

  /**
   * Menyimpan server VPN yang sedang dipakai router. Hanya router yang masih
   * mode VPN: monitor membaca core sebelum menulis, dan router yang kembali ke
   * PUBLIC di antaranya tidak boleh mendapat server aktif basi.
   */
  async setActiveServer(
    routerId: string,
    tenantId: string,
    serverId: string | null,
  ): Promise<void> {
    await this.client.mikroTikRouter.updateMany({
      where: { id: routerId, tenantId, connectionMode: "VPN" },
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
