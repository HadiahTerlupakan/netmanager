import { logger } from "@/lib/logger";
import type { IVpnCoreRouterTombstoneRepository } from "../domain/ports/IVpnCoreRouterTombstoneRepository";
import type {
  IVpnRouterMigrationRepository,
  VpnMigrationRouterRecord,
} from "../domain/ports/IVpnRouterMigrationRepository";
import type { IVpnServerRepository } from "../domain/ports/IVpnServerRepository";
import {
  VpnDraftInvalidError,
  VpnRouterActivationError,
  VpnRouterMigrationError,
} from "../vpn/errors";
import { getVpnCoreAddress, getVpnCoreClient } from "../vpn/VpnCoreClient";
import type { MikroTikProvisioningRouterDetails } from "./mikrotik-provisioning.connection";
import {
  vpnMigrationRouterOs,
  type RadiusEntryConfig,
  type VpnMigrationRouterOs,
} from "./mikrotik-vpn-migration.routeros";
import {
  deleteCoreRouterOrTombstone,
  tombstoneCoreRouter,
} from "./VpnCoreRouterCleanup";
import {
  hasSameHubOrder,
  type VpnDraftService,
  type VpnExtendDraftResult,
} from "./VpnDraftService";
import {
  apiUsernameOf,
  assertServersOnline,
  assertTunnelApi,
  assertTunnelUp,
  fetchUnclaimedDraft,
  requirePublicV7Router,
  requireRevertableRouter,
  routerApiConnection,
} from "./vpn-migration.preconditions";

/** Peringatan bila migrasi selesai tetapi entri /radius lama masih di router. */
export const OLD_RADIUS_ENTRY_WARNING =
  "Entri RADIUS lama belum terhapus dari router";

/** Hasil pindah mode; `warning` diisi bila langkah pembersihan terakhir gagal. */
export interface VpnMigrationResult {
  warning?: string;
}

/** Permintaan pindah ke VPN: draft yang tunnelnya sudah hidup dan urutan servernya. */
export interface VpnMigrateInput {
  draftId: string;
  serverIds: string[];
}

function radiusConfigOf(router: VpnMigrationRouterRecord): RadiusEntryConfig {
  return {
    secretRadius: router.secretRadius,
    authPort: router.authPort,
    accountingPort: router.accountingPort,
    isolirUrl: router.isolirUrl,
  };
}

/**
 * Memindah router lama PUBLIC ⇄ VPN tanpa memutus login PPPoE (Ruling R12):
 * entri /radius baru dipasang lebih dulu, lalu database (termasuk nasname)
 * berpindah, baru entri lama dihapus. Setiap langkah yang gagal membatalkan
 * langkah sebelumnya. Semua perintah RouterOS lewat alamat tunnel.
 */
export class VpnRouterMigrationService {
  constructor(
    private readonly repo: IVpnRouterMigrationRepository,
    private readonly servers: Pick<IVpnServerRepository, "tenantServers">,
    private readonly drafts: Pick<VpnDraftService, "createExtendDraft">,
    private readonly tombstones: Pick<IVpnCoreRouterTombstoneRepository, "add">,
    private readonly routerOs: VpnMigrationRouterOs = vpnMigrationRouterOs,
    private readonly now: () => number = Date.now,
  ) {}

  /** Draft dan skrip tempel untuk router publik v7; user API lama dipakai ulang. */
  async enable(
    routerId: string,
    tenantId: string,
    input: { serverIds: string[]; previousDraftId?: string },
  ): Promise<VpnExtendDraftResult> {
    const router = requirePublicV7Router(
      await this.repo.findRouter(routerId, tenantId),
    );
    return this.drafts.createExtendDraft(
      tenantId,
      input,
      apiUsernameOf(router),
    );
  }

  /** Test login API lewat tunnel draft sebelum tombol "Pindahkan ke VPN" dibuka. */
  async testTunnel(
    routerId: string,
    tenantId: string,
    draftId: string,
  ): Promise<{ version: string }> {
    const router = requirePublicV7Router(
      await this.repo.findRouter(routerId, tenantId),
    );
    const draft = await fetchUnclaimedDraft(draftId, tenantId);
    assertTunnelUp(draft, this.now());
    const version = await assertTunnelApi(
      this.routerOs,
      routerApiConnection(router, draft.address),
    );
    return { version };
  }

  /** PUBLIC → VPN. Semua syarat diperiksa sebelum ada yang diubah. */
  async migrate(
    routerId: string,
    tenantId: string,
    input: VpnMigrateInput,
  ): Promise<VpnMigrationResult> {
    const router = requirePublicV7Router(
      await this.repo.findRouter(routerId, tenantId),
    );
    const draft = await fetchUnclaimedDraft(input.draftId, tenantId);
    if (!hasSameHubOrder(draft, input.serverIds)) {
      throw new VpnDraftInvalidError("Server VPN tidak cocok dengan draft VPN");
    }
    await assertServersOnline(this.servers, tenantId, input.serverIds);
    assertTunnelUp(draft, this.now());
    const tunnel = routerApiConnection(router, draft.address);
    await assertTunnelApi(this.routerOs, tunnel);

    const coreAddress = getVpnCoreAddress();
    await this.addEntry(tunnel, coreAddress, draft.address, router);
    try {
      await this.repo.switchToVpn(router, {
        tunnelAddress: draft.address,
        coreRouterId: draft.id,
        serverIds: input.serverIds,
      });
    } catch (error) {
      logger.error(
        `[VPN] Router ${router.id} gagal disimpan sebagai VPN:`,
        error,
      );
      await this.removeEntryQuietly(tunnel, coreAddress);
      throw new VpnRouterMigrationError("Gagal menyimpan mode VPN router");
    }
    try {
      await getVpnCoreClient().claimRouter(draft.id, router.id);
    } catch (error) {
      logger.error(`[VPN] Claim draft ${draft.id} gagal:`, error);
      await this.undoSwitchToVpn(router, draft.address);
      await this.removeEntryQuietly(tunnel, coreAddress);
      // Claim yang timeout bisa saja sudah berhasil di core.
      await tombstoneCoreRouter(draft.id, this.tombstones);
      throw new VpnRouterActivationError();
    }
    return this.removeOldEntry(tunnel, () =>
      this.routerOs.publicRadiusAddress(),
    );
  }

  /**
   * VPN → PUBLIC lewat tunnel. Tunnel WireGuard tetap terpasang di router
   * sampai admin menghapusnya, jadi API publik router tidak perlu terjangkau.
   */
  async revert(
    routerId: string,
    tenantId: string,
  ): Promise<VpnMigrationResult> {
    const router = requireRevertableRouter(
      await this.repo.findRouter(routerId, tenantId),
    );
    const tunnel = routerApiConnection(router, router.ipAddress);
    const publicAddress = await this.routerOs.publicRadiusAddress();
    await this.addEntry(tunnel, publicAddress, null, router);
    try {
      await this.repo.switchToPublic(router);
    } catch (error) {
      logger.error(
        `[VPN] Router ${router.id} gagal disimpan sebagai publik:`,
        error,
      );
      await this.removeEntryQuietly(tunnel, publicAddress);
      throw new VpnRouterMigrationError("Gagal menyimpan mode publik router");
    }
    const result = await this.removeOldEntry(tunnel, async () =>
      getVpnCoreAddress(),
    );
    await deleteCoreRouterOrTombstone(router.vpnCoreRouterId, this.tombstones);
    return result;
  }

  private async addEntry(
    conn: MikroTikProvisioningRouterDetails,
    serverIp: string,
    srcAddress: string | null,
    router: VpnMigrationRouterRecord,
  ): Promise<void> {
    try {
      await this.routerOs.addRadiusEntry(
        conn,
        serverIp,
        srcAddress,
        radiusConfigOf(router),
      );
    } catch (error) {
      logger.error(
        `[VPN] Gagal memasang RADIUS ${serverIp} di router ${router.id}:`,
        error,
      );
      throw new VpnRouterMigrationError("Gagal memasang RADIUS lewat tunnel");
    }
  }

  private async removeEntryQuietly(
    conn: MikroTikProvisioningRouterDetails,
    serverIp: string,
  ): Promise<void> {
    try {
      await this.routerOs.removeRadiusEntry(conn, serverIp);
    } catch (error) {
      logger.error(`[VPN] Gagal membatalkan entri RADIUS ${serverIp}:`, error);
    }
  }

  // Router sudah berjalan di mode baru; entri lama yang tertinggal hanya
  // dilaporkan, tidak membatalkan perpindahan.
  private async removeOldEntry(
    conn: MikroTikProvisioningRouterDetails,
    resolveServerIp: () => Promise<string>,
  ): Promise<VpnMigrationResult> {
    try {
      await this.routerOs.removeRadiusEntry(conn, await resolveServerIp());
      return {};
    } catch (error) {
      logger.warn("[VPN] Entri RADIUS lama belum terhapus:", error);
      return { warning: OLD_RADIUS_ENTRY_WARNING };
    }
  }

  private async undoSwitchToVpn(
    router: VpnMigrationRouterRecord,
    tunnelAddress: string,
  ): Promise<void> {
    try {
      await this.repo.switchToPublic({
        ...router,
        connectionMode: "VPN",
        ipAddress: tunnelAddress,
        publicIpAddress: router.ipAddress,
      });
    } catch (error) {
      logger.error(
        `[VPN] Gagal mengembalikan router ${router.id} ke publik:`,
        error,
      );
    }
  }
}
