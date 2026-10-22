/** Router mode VPN beserta kredensial API untuk menulis ke RouterOS. */
export interface VpnRouterRecord {
  id: string;
  connectionMode: "PUBLIC" | "VPN";
  vpnCoreRouterId: string | null;
  vpnActiveServerId: string | null;
  vpnScriptStale: boolean;
  ipAddress: string;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
  apiUsernameGenerated: string | null;
  apiPasswordGenerated: string | null;
}

/** Satu server VPN pada daftar urut sebuah router. */
export interface RouterVpnServerEntry {
  id: string;
  name: string;
  priority: number;
}

/**
 * Akses database untuk kolom dan daftar server VPN sebuah router. Setiap
 * metode menyaring router menurut tenant, termasuk untuk tabel
 * MikroTikRouterVpnServer yang tidak diisolasi otomatis.
 */
export interface IMikroTikRouterVpnRepository {
  /** Router milik tenant, atau null. */
  findRouter(id: string, tenantId: string): Promise<VpnRouterRecord | null>;

  /** Daftar server router menurut prioritas. */
  listServers(
    routerId: string,
    tenantId: string,
  ): Promise<RouterVpnServerEntry[]>;

  /** Mengganti daftar server router dan menandai skripnya belum terkirim. */
  replaceServersAsStale(
    routerId: string,
    tenantId: string,
    serverIds: string[],
  ): Promise<void>;

  /**
   * Menjalankan `fn` sambil memegang kunci daftar server router, tanpa
   * menunggu: bila request lain memegangnya, `fn` tidak dijalankan dan
   * hasilnya `{ acquired: false }`. Kunci lepas saat `fn` selesai atau melempar.
   */
  withServerListLock<T>(
    routerId: string,
    fn: () => Promise<T>,
  ): Promise<{ acquired: true; value: T } | { acquired: false }>;

  /**
   * Menyelesaikan pengiriman skrip switch secara compare-and-set: bila daftar
   * server lokal masih `sentServerIds`, jalankan `finalize` lalu tandai skrip
   * terkirim dan kembalikan true. Bila daftar sudah diganti request lain,
   * `finalize` dilewati, skrip ditandai belum terkirim, dan hasilnya false.
   */
  completeScriptSend(
    routerId: string,
    tenantId: string,
    sentServerIds: string[],
    finalize: () => Promise<void>,
  ): Promise<boolean>;

  /** Menyimpan server VPN yang sedang dipakai router. */
  setActiveServer(
    routerId: string,
    tenantId: string,
    serverId: string | null,
  ): Promise<void>;

  /** Router VPN online yang skripnya belum terkirim, paling lama dulu. */
  findStaleOnline(tenantId: string, limit: number): Promise<VpnRouterRecord[]>;
}
