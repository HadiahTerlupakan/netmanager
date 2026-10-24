import type { VpnProtocol } from "@prisma/client";
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
  VpnRouterBusyError,
  VpnRouterMigrationError,
  VpnRouterRollbackError,
} from "../vpn/errors";
import { fromCoreProtocol } from "../vpn/protocol";
import { getVpnCoreAddress, getVpnCoreClient } from "../vpn/VpnCoreClient";
import type { CoreRouter } from "../vpn/types";
import type { MikroTikProvisioningRouterDetails } from "./mikrotik-provisioning.connection";
import {
  vpnMigrationRouterOs,
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
  assertTunnelApi,
  assertTunnelUp,
  fetchUnclaimedDraft,
  requirePublicV7Router,
  requireRevertableRouter,
  routerApiConnection,
} from "./vpn-migration.preconditions";
import { assertNotVpnOverlayTarget } from "./vpn-overlay-target";
import { assertServersUsable } from "./vpn-server-availability";
import {
  VpnMigrationRadiusSteps,
  type VpnMigrationResult,
} from "./vpn-migration.radius-steps";

export {
  OLD_RADIUS_ENTRY_WARNING,
  type VpnMigrationResult,
} from "./vpn-migration.radius-steps";

/** Pembatalan klaim gagal: database masih VPN dengan draft yang belum di-claim. */
export const STUCK_VPN_MESSAGE =
  "Router tetap mode VPN, aktivasi belum selesai; hubungi admin";
/** Pembatalan gagal menghapus entri /radius yang baru dipasang. */
export const EXTRA_RADIUS_ENTRY_MESSAGE =
  "Entri RADIUS tambahan belum terhapus dari router; hubungi admin";
const UNCERTAIN_PUBLIC_ADDRESS_MESSAGE =
  "Alamat RADIUS publik tidak dapat dipastikan";

/** Permintaan pindah ke VPN: draft yang tunnelnya sudah hidup dan urutan servernya. */
export interface VpnMigrateInput {
  draftId: string;
  serverIds: string[];
}

/**
 * Memindah router lama PUBLIC ⇄ VPN tanpa memutus login PPPoE (Ruling R12):
 * entri /radius baru dipasang lebih dulu, lalu database (termasuk nasname)
 * berpindah, baru entri lama dihapus. Setiap langkah yang gagal membatalkan
 * langkah sebelumnya. Semua perintah RouterOS lewat alamat tunnel.
 */
export class VpnRouterMigrationService {
  private readonly radius: VpnMigrationRadiusSteps;

  constructor(
    private readonly repo: IVpnRouterMigrationRepository,
    private readonly servers: Pick<IVpnServerRepository, "tenantServers">,
    private readonly drafts: Pick<VpnDraftService, "createExtendDraft">,
    private readonly tombstones: Pick<
      IVpnCoreRouterTombstoneRepository,
      "add" | "has"
    >,
    private readonly routerOs: VpnMigrationRouterOs = vpnMigrationRouterOs,
    private readonly now: () => number = Date.now,
  ) {
    this.radius = new VpnMigrationRadiusSteps(routerOs);
  }

  /** Draft dan skrip tempel untuk router publik v7; user API lama dipakai ulang. */
  async enable(
    routerId: string,
    tenantId: string,
    input: {
      serverIds: string[];
      protocol: VpnProtocol;
      previousDraftId?: string;
    },
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
    const draft = await fetchUnclaimedDraft(draftId, tenantId, this.tombstones);
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
    const draft = await fetchUnclaimedDraft(
      input.draftId,
      tenantId,
      this.tombstones,
    );
    if (!hasSameHubOrder(draft, input.serverIds)) {
      throw new VpnDraftInvalidError("Server VPN tidak cocok dengan draft VPN");
    }
    await assertServersUsable(
      this.servers,
      tenantId,
      input.serverIds,
      draft.protocol,
    );
    assertTunnelUp(draft, this.now());
    const tunnel = routerApiConnection(router, draft.address);
    await assertTunnelApi(this.routerOs, tunnel);

    const coreAddress = getVpnCoreAddress();
    await this.radius.add(tunnel, coreAddress, draft.address, router);
    try {
      await this.repo.switchToVpn(router, {
        tunnelAddress: draft.address,
        coreRouterId: draft.id,
        vpnProtocol: fromCoreProtocol(draft.protocol),
        serverIds: input.serverIds,
      });
    } catch (error) {
      await this.undoAfterFailedSwitch(error, router, tunnel, coreAddress);
      throw new VpnRouterMigrationError("Gagal menyimpan mode VPN router");
    }
    try {
      await getVpnCoreClient().claimRouter(draft.id, router.id);
    } catch (error) {
      logger.error(`[VPN] Claim draft ${draft.id} gagal:`, error);
      await this.undoAfterFailedClaim(router, draft, tunnel, coreAddress);
      throw new VpnRouterActivationError();
    }
    return this.radius.removeOthers(tunnel, coreAddress);
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
    // Setelah revert nasname kembali ke alamat publik ini.
    await assertNotVpnOverlayTarget(router.publicIpAddress);
    const tunnel = routerApiConnection(router, router.ipAddress);
    const publicAddress = await this.certainPublicRadiusAddress();
    await this.radius.add(tunnel, publicAddress, null, router);
    try {
      await this.repo.switchToPublic(router);
    } catch (error) {
      await this.undoAfterFailedSwitch(error, router, tunnel, publicAddress);
      throw new VpnRouterMigrationError("Gagal menyimpan mode publik router");
    }
    const result = await this.radius.removeOthers(tunnel, publicAddress);
    await deleteCoreRouterOrTombstone(router.vpnCoreRouterId, this.tombstones);
    return result;
  }

  // Tebakan dari interface lokal bisa bukan alamat yang dilihat router; entri
  // /radius ke alamat itu akan memutus semua login PPPoE.
  private async certainPublicRadiusAddress(): Promise<string> {
    const { ip, source } = await this.routerOs.publicRadiusAddress();
    if (source === "local") {
      throw new VpnRouterMigrationError(UNCERTAIN_PUBLIC_ADDRESS_MESSAGE);
    }
    return ip;
  }

  /**
   * Setelah simpan database gagal: hapus entri yang baru dipasang. Bila permintaan
   * lain sudah memindah router, entri itu kini miliknya, jadi tidak disentuh.
   */
  private async undoAfterFailedSwitch(
    error: unknown,
    router: VpnMigrationRouterRecord,
    tunnel: MikroTikProvisioningRouterDetails,
    addedServerIp: string,
  ): Promise<void> {
    if (error instanceof VpnRouterBusyError) throw error;
    logger.error(`[VPN] Router ${router.id} gagal pindah mode:`, error);
    if (!(await this.radius.undoAdd(tunnel, addedServerIp))) {
      throw new VpnRouterRollbackError(EXTRA_RADIUS_ENTRY_MESSAGE);
    }
  }

  /**
   * Setelah claim gagal: kembalikan database, hapus entri tunnel, dan jadwalkan
   * penghapusan draft. Bila database tidak bisa dikembalikan, router memang
   * masih VPN, jadi entri tunnel dan draft-nya dibiarkan.
   */
  private async undoAfterFailedClaim(
    router: VpnMigrationRouterRecord,
    draft: CoreRouter,
    tunnel: MikroTikProvisioningRouterDetails,
    coreAddress: string,
  ): Promise<void> {
    if (!(await this.undoSwitchToVpn(router, draft.address))) {
      logger.error(
        `[VPN] Router ${router.id} tertinggal mode VPN dengan router core ${draft.id} belum di-claim`,
      );
      throw new VpnRouterRollbackError(STUCK_VPN_MESSAGE);
    }
    const isEntryRemoved = await this.radius.undoAdd(tunnel, coreAddress);
    // Claim yang timeout bisa saja sudah berhasil di core.
    await tombstoneCoreRouter(draft.id, this.tombstones);
    if (!isEntryRemoved) {
      throw new VpnRouterRollbackError(EXTRA_RADIUS_ENTRY_MESSAGE);
    }
  }

  private async undoSwitchToVpn(
    router: VpnMigrationRouterRecord,
    tunnelAddress: string,
  ): Promise<boolean> {
    try {
      await this.repo.switchToPublic({
        ...router,
        connectionMode: "VPN",
        ipAddress: tunnelAddress,
        publicIpAddress: router.ipAddress,
      });
      return true;
    } catch (error) {
      logger.error(
        `[VPN] Gagal mengembalikan router ${router.id} ke publik:`,
        error,
      );
      return false;
    }
  }
}
