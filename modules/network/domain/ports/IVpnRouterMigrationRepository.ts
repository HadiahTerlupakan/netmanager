import type { RouterIsolirMode } from "../entities/MikroTikRouterEntity";

/** Router beserta kolom yang dibutuhkan untuk pindah PUBLIC ⇄ VPN. */
export interface VpnMigrationRouterRecord {
  id: string;
  tenantId: string;
  name: string;
  connectionMode: "PUBLIC" | "VPN";
  rosVersion: "V6" | "V7";
  ipAddress: string;
  publicIpAddress: string | null;
  vpnCoreRouterId: string | null;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
  apiUsernameGenerated: string | null;
  apiPasswordGenerated: string | null;
  secretRadius: string;
  authPort: number;
  accountingPort: number;
  isolirMode: RouterIsolirMode;
  isolirUrl: string | null;
}

/** Data VPN yang ditulis saat router publik pindah ke VPN. */
export interface VpnSwitchChange {
  tunnelAddress: string;
  coreRouterId: string;
  vpnProtocol: "WIREGUARD" | "L2TP";
  serverIds: string[];
}

/**
 * Penulisan database untuk pindah PUBLIC ⇄ VPN. Kolom router, daftar server,
 * dan nasname NAS berubah bersama; bila salah satu gagal tidak ada yang tersimpan.
 * Kedua switch melempar `VpnRouterBusyError` bila mode router sudah diubah
 * permintaan lain.
 */
export interface IVpnRouterMigrationRepository {
  /** Router milik tenant, atau null. */
  findRouter(
    id: string,
    tenantId: string,
  ): Promise<VpnMigrationRouterRecord | null>;

  /** PUBLIC → VPN: IP publik disimpan, IP router menjadi alamat tunnel. */
  switchToVpn(
    router: VpnMigrationRouterRecord,
    change: VpnSwitchChange,
  ): Promise<void>;

  /**
   * VPN → PUBLIC: IP router kembali ke `publicIpAddress`, kolom VPN dan daftar
   * server dihapus. `router.ipAddress` adalah alamat tunnel saat ini.
   */
  switchToPublic(router: VpnMigrationRouterRecord): Promise<void>;
}
