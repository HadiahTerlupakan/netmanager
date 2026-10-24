import type { CoreHub } from "../../vpn/types";
import type { VpnServerRouterUsage } from "../../vpn/errors";

/** Ringkasan server VPN untuk tenant. */
export interface VpnServerSummary {
  id: string;
  name: string;
  publicHost: string;
  status: string;
  protocols: string[];
}

export interface IVpnServerRepository {
  /** Menyimpan hub dari core; baris yang ada diperbarui. */
  upsertHub(hub: CoreHub): Promise<void>;

  /** Jumlah tenant per id server VPN. */
  tenantCounts(): Promise<Map<string, number>>;

  /** Router (beserta nama tenant) yang memakai salah satu server; dibatasi tenant bila diberikan. */
  routersUsing(
    serverIds: string[],
    tenantId?: string,
  ): Promise<VpnServerRouterUsage[]>;

  /** Menghapus server beserta assignment tenant-nya dalam satu transaksi. */
  deleteServer(id: string): Promise<void>;

  /** Id server VPN yang diizinkan untuk tenant. */
  tenantServerIds(tenantId: string): Promise<string[]>;

  /** Banyaknya id yang benar-benar ada sebagai server VPN. */
  countExisting(ids: string[]): Promise<number>;

  /** Mengganti seluruh assignment server VPN sebuah tenant. */
  replaceTenantServers(tenantId: string, ids: string[]): Promise<void>;

  /** Server VPN yang di-assign ke tenant beserta statusnya. */
  tenantServers(tenantId: string): Promise<VpnServerSummary[]>;

  /**
   * Menambahkan server sebagai cadangan terakhir ke setiap router VPN tenant
   * yang belum memakainya, lalu menandai skripnya belum terkirim. Hanya router
   * yang berubah yang disentuh; mengembalikan jumlahnya.
   */
  appendServerToTenantRouters(
    tenantId: string,
    serverId: string,
    protocols: ("WIREGUARD" | "L2TP")[],
  ): Promise<number>;

  /**
   * Mengeluarkan server dari semua router yang memakainya, lintas tenant.
   * Router yang hanya memakai server ini tidak diubah dan dilaporkan di
   * `onlyServer`; router lain ditandai belum terkirim dan prioritasnya dirapatkan.
   */
  detachServerFromRouters(
    serverId: string,
  ): Promise<{ detached: number; onlyServer: VpnServerRouterUsage[] }>;
}
