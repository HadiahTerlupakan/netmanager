import type { IsolirMode, RouterConnectionMode } from "@prisma/client";
import { tryResolveIsolirProvisioning } from "../isolir/isolir-provisioning";
import { MikroTikProvisioningService } from "./MikroTikProvisioningService";
import {
  runProvisioningConnection,
  type MikroTikProvisioningRouterDetails,
} from "./mikrotik-provisioning.connection";
import {
  detectPublicIpWithSource,
  type PublicIpSource,
} from "./mikrotik-provisioning.ip-detection";
import {
  removeOtherRadiusConfigs,
  removeRadiusConfig,
} from "./mikrotik-provisioning.radius";
import {
  testMikroTikAPI,
  type TestConnectionResult,
} from "./mikrotik/router-api-test";

/**
 * Rahasia dan port RADIUS router (sama dengan entri NAS-nya) beserta mode
 * isolirnya. `connectionMode` adalah mode tujuan migrasi, bukan mode yang
 * tersimpan: rule isolir dipasang untuk router setelah pindah.
 */
export interface RadiusEntryConfig {
  secretRadius: string;
  authPort: number;
  accountingPort: number;
  isolirMode: IsolirMode;
  isolirUrl: string | null;
  tenantId: string;
  connectionMode: RouterConnectionMode;
}

/**
 * Langkah RouterOS untuk pindah PUBLIC ⇄ VPN. Dipisah dari service agar urutan
 * langkah dan pembatalannya bisa diuji tanpa router.
 */
export interface VpnMigrationRouterOs {
  /** Login API dan baca info router (termasuk versi RouterOS). */
  testApi(
    conn: MikroTikProvisioningRouterDetails,
  ): Promise<TestConnectionResult>;
  /** Tambah/perbarui entri /radius netmanager untuk `serverIp`; melempar bila gagal. */
  addRadiusEntry(
    conn: MikroTikProvisioningRouterDetails,
    serverIp: string,
    srcAddress: string | null,
    config: RadiusEntryConfig,
  ): Promise<void>;
  /** Hapus hanya entri /radius netmanager untuk `serverIp`; firewall dan proxy tidak disentuh. */
  removeRadiusEntry(
    conn: MikroTikProvisioningRouterDetails,
    serverIp: string,
  ): Promise<void>;
  /**
   * Hapus setiap entri /radius netmanager selain `keepServerIp`; jumlah yang
   * dihapus. Entri lama dicari menurut komentarnya, bukan alamat tebakan.
   */
  removeOtherRadiusEntries(
    conn: MikroTikProvisioningRouterDetails,
    keepServerIp: string,
  ): Promise<number>;
  /** Alamat RADIUS publik netmanager beserta asalnya. */
  publicRadiusAddress(): Promise<{ ip: string; source: PublicIpSource }>;
}

/** Implementasi `VpnMigrationRouterOs` lewat API RouterOS. */
export const vpnMigrationRouterOs: VpnMigrationRouterOs = {
  testApi: (conn) =>
    testMikroTikAPI({
      ipAddress: conn.ip,
      port: conn.port,
      username: conn.username,
      password: conn.password,
    }),
  async addRadiusEntry(conn, serverIp, srcAddress, config) {
    // Galat isolir sudah dicatat di log; migrasi tetap memasang RADIUS.
    const { isolir } = await tryResolveIsolirProvisioning(config);
    const result = await new MikroTikProvisioningService().provisionRadius(
      conn,
      serverIp,
      config.secretRadius,
      isolir,
      config.authPort,
      config.accountingPort,
      srcAddress,
    );
    if (!result.success) throw new Error(result.logs.join(", "));
  },
  removeRadiusEntry: (conn, serverIp) =>
    runProvisioningConnection({
      routerDetails: conn,
      operation: (connection) =>
        removeRadiusConfig({ connection, serverIp, logs: [] }),
    }),
  removeOtherRadiusEntries: (conn, keepServerIp) =>
    runProvisioningConnection({
      routerDetails: conn,
      operation: (connection) =>
        removeOtherRadiusConfigs({ connection, keepServerIp }),
    }),
  publicRadiusAddress: detectPublicIpWithSource,
};
