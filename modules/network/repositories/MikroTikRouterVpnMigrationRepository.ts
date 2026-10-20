import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IVpnRouterMigrationRepository,
  VpnMigrationRouterRecord,
  VpnSwitchChange,
} from "../domain/ports/IVpnRouterMigrationRepository";
import { applyNasOnRouterUpdate } from "./MikroTikRouterRepository.sync";
import { RadiusRepository } from "./RadiusRepository";

const MIGRATION_ROUTER_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  connectionMode: true,
  rosVersion: true,
  ipAddress: true,
  publicIpAddress: true,
  vpnCoreRouterId: true,
  apiPort: true,
  apiUsername: true,
  apiPassword: true,
  apiUsernameGenerated: true,
  apiPasswordGenerated: true,
  secretRadius: true,
  authPort: true,
  accountingPort: true,
  isolirUrl: true,
} as const;

/** Mode router berubah di antara baca dan tulis (permintaan lain lebih dulu). */
class RouterModeChangedError extends Error {
  constructor() {
    super("Mode koneksi router berubah saat dipindahkan");
    this.name = "RouterModeChangedError";
  }
}

/** Akses database untuk pindah PUBLIC ⇄ VPN, selalu disaring tenant. */
export class MikroTikRouterVpnMigrationRepository implements IVpnRouterMigrationRepository {
  private readonly radiusRepo: RadiusRepository;

  constructor(private readonly client: PrismaClient = prisma) {
    this.radiusRepo = new RadiusRepository(client);
  }

  /** Router milik tenant, atau null. */
  async findRouter(
    id: string,
    tenantId: string,
  ): Promise<VpnMigrationRouterRecord | null> {
    const router = await this.client.mikroTikRouter.findFirst({
      where: { id, tenantId },
      select: MIGRATION_ROUTER_SELECT,
    });
    if (!router?.tenantId) return null;
    return { ...router, tenantId: router.tenantId };
  }

  /**
   * PUBLIC → VPN dalam satu transaksi. NAS diperbarui di dalam transaksi
   * sehingga kegagalannya membatalkan perubahan router: nasname yang tertinggal
   * di IP publik membuat semua login PPPoE lewat tunnel ditolak.
   */
  async switchToVpn(
    router: VpnMigrationRouterRecord,
    change: VpnSwitchChange,
  ): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const updated = await tx.mikroTikRouter.updateMany({
        where: {
          id: router.id,
          tenantId: router.tenantId,
          connectionMode: "PUBLIC",
        },
        data: {
          updatedAt: new Date(),
          publicIpAddress: router.ipAddress,
          ipAddress: change.tunnelAddress,
          vpnAddress: change.tunnelAddress,
          connectionMode: "VPN",
          vpnCoreRouterId: change.coreRouterId,
          vpnActiveServerId: null,
          vpnScriptStale: false,
        },
      });
      if (updated.count === 0) throw new RouterModeChangedError();
      await tx.mikroTikRouterVpnServer.deleteMany({
        where: { routerId: router.id },
      });
      await tx.mikroTikRouterVpnServer.createMany({
        data: change.serverIds.map((vpnServerId, priority) => ({
          routerId: router.id,
          vpnServerId,
          priority,
        })),
      });
      await this.moveNas(router, router.ipAddress, change.tunnelAddress);
    });
  }

  /** VPN → PUBLIC dalam satu transaksi, NAS ikut seperti `switchToVpn`. */
  async switchToPublic(router: VpnMigrationRouterRecord): Promise<void> {
    const publicIp = router.publicIpAddress;
    if (!publicIp) throw new Error("IP publik router tidak diketahui");
    await this.client.$transaction(async (tx) => {
      const updated = await tx.mikroTikRouter.updateMany({
        where: {
          id: router.id,
          tenantId: router.tenantId,
          connectionMode: "VPN",
        },
        data: {
          updatedAt: new Date(),
          ipAddress: publicIp,
          publicIpAddress: null,
          connectionMode: "PUBLIC",
          vpnAddress: null,
          vpnCoreRouterId: null,
          vpnActiveServerId: null,
          vpnScriptStale: false,
        },
      });
      if (updated.count === 0) throw new RouterModeChangedError();
      await tx.mikroTikRouterVpnServer.deleteMany({
        where: { routerId: router.id },
      });
      await this.moveNas(router, router.ipAddress, publicIp);
    });
  }

  private moveNas(
    router: VpnMigrationRouterRecord,
    fromIp: string,
    toIp: string,
  ): Promise<void> {
    return applyNasOnRouterUpdate(
      this.radiusRepo,
      {
        ipAddress: fromIp,
        secretRadius: router.secretRadius,
        name: router.name,
        tenantId: router.tenantId,
      },
      { ipAddress: toIp },
    );
  }
}
