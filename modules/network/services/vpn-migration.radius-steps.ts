import { logger } from "@/lib/logger";
import type { VpnMigrationRouterRecord } from "../domain/ports/IVpnRouterMigrationRepository";
import { VpnRouterMigrationError } from "../vpn/errors";
import type { MikroTikProvisioningRouterDetails } from "./mikrotik-provisioning.connection";
import type { VpnMigrationRouterOs } from "./mikrotik-vpn-migration.routeros";

/** Peringatan bila migrasi selesai tetapi entri /radius lama masih di router. */
export const OLD_RADIUS_ENTRY_WARNING =
  "Entri RADIUS lama belum terhapus dari router";

/** Hasil pindah mode; `warning` diisi bila langkah pembersihan terakhir gagal. */
export interface VpnMigrationResult {
  warning?: string;
}

/**
 * Langkah /radius pindah PUBLIC ⇄ VPN di atas `VpnMigrationRouterOs`: pasang,
 * batalkan, dan bersihkan entri netmanager dengan log dan galat yang seragam.
 */
export class VpnMigrationRadiusSteps {
  constructor(private readonly routerOs: VpnMigrationRouterOs) {}

  /** Pasang entri untuk `serverIp`; melempar `VpnRouterMigrationError` bila gagal. */
  async add(
    conn: MikroTikProvisioningRouterDetails,
    serverIp: string,
    srcAddress: string | null,
    router: VpnMigrationRouterRecord,
  ): Promise<void> {
    try {
      await this.routerOs.addRadiusEntry(conn, serverIp, srcAddress, {
        secretRadius: router.secretRadius,
        authPort: router.authPort,
        accountingPort: router.accountingPort,
        isolirUrl: router.isolirUrl,
      });
    } catch (error) {
      logger.error(
        `[VPN] Gagal memasang RADIUS ${serverIp} di router ${router.id}:`,
        error,
      );
      throw new VpnRouterMigrationError("Gagal memasang RADIUS lewat tunnel");
    }
  }

  /** Batalkan entri yang baru dipasang; false bila entri masih di router. */
  async undoAdd(
    conn: MikroTikProvisioningRouterDetails,
    serverIp: string,
  ): Promise<boolean> {
    try {
      await this.routerOs.removeRadiusEntry(conn, serverIp);
      return true;
    } catch (error) {
      logger.error(`[VPN] Gagal membatalkan entri RADIUS ${serverIp}:`, error);
      return false;
    }
  }

  /**
   * Hapus semua entri netmanager selain `keepServerIp`. Router sudah berjalan
   * di mode baru, jadi kegagalan (atau tidak ada entri lama yang ditemukan)
   * hanya dilaporkan lewat `warning`.
   */
  async removeOthers(
    conn: MikroTikProvisioningRouterDetails,
    keepServerIp: string,
  ): Promise<VpnMigrationResult> {
    try {
      const removed = await this.routerOs.removeOtherRadiusEntries(
        conn,
        keepServerIp,
      );
      if (removed > 0) return {};
      logger.warn(`[VPN] Tidak ada entri RADIUS lama selain ${keepServerIp}`);
    } catch (error) {
      logger.warn("[VPN] Entri RADIUS lama belum terhapus:", error);
    }
    return { warning: OLD_RADIUS_ENTRY_WARNING };
  }
}
