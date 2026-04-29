import type { prisma as defaultPrisma } from "@/lib/prisma";
import { buildMikrotikRateLimit } from "../utils/radius-rate-limit";
import {
  EXPIRED_USERS_PROFILE,
  FRAMED_POOL_ATTRIBUTE,
  GROUP_REPLY_ASSIGN_OP,
  ISOLIR_GROUP_PRIORITY,
  MIKROTIK_GROUP_ATTRIBUTE,
  MIKROTIK_RATE_LIMIT_ATTRIBUTE,
  PACKAGE_GROUP_PRIORITY,
  POOL_NAME_ATTRIBUTE,
} from "./radiusRepository.constants";

type PrismaInstance = typeof defaultPrisma;

type RadiusSyncOperations = {
  deleteRadiusUser(username: string, tenantId: string): Promise<void>;
  userExists(username: string, tenantId: string): Promise<boolean>;
  createRadiusUser(
    data: { username: string; password: string },
    tenantId: string,
  ): Promise<void>;
  updateRadiusPassword(
    username: string,
    password: string,
    tenantId: string,
  ): Promise<void>;
  assignUserToGroup(
    username: string,
    groupname: string,
    tenantId: string,
    priority?: number,
  ): Promise<void>;
  getUserGroups(username: string, tenantId: string): Promise<string[]>;
  removeUserFromGroup(
    username: string,
    groupname: string,
    tenantId: string,
  ): Promise<void>;
  setGroupAttribute(
    groupname: string,
    attribute: string,
    value: string,
    tenantId: string,
  ): Promise<void>;
  removeGroupAttribute(
    groupname: string,
    attribute: string,
    tenantId: string,
  ): Promise<void>;
  setGroupCheckAttribute(
    groupname: string,
    attribute: string,
    value: string,
    tenantId: string,
    op?: string,
  ): Promise<void>;
  removeGroupCheckAttribute(
    groupname: string,
    attribute: string,
    tenantId: string,
  ): Promise<void>;
  setGroupBandwidth(
    groupname: string,
    bandwidth: string,
    tenantId: string,
  ): Promise<void>;
};

type RadiusClient = {
  radreply: {
    deleteMany(input: {
      where: { username?: string; attribute: string; tenantId: string };
    }): Promise<unknown>;
  };
};

export class RadiusSyncRepository {
  constructor(
    private readonly prisma: PrismaInstance,
    private readonly radiusClient: RadiusClient,
    private readonly operations: RadiusSyncOperations,
  ) {}

  /** Sync single pelanggan to RADIUS. */
  async syncPelangganToRadius(pelangganId: string): Promise<void> {
    const pelanggan = await this.findPelangganWithPackage(pelangganId);
    if (!pelanggan) throw new Error(`Pelanggan ${pelangganId} not found`);
    if (!pelanggan.tenantId) {
      throw new Error(`Pelanggan ${pelangganId} does not have a tenantId`);
    }

    if (this.shouldDeleteRadiusUser(pelanggan.status)) {
      await this.operations.deleteRadiusUser(
        pelanggan.username,
        pelanggan.tenantId,
      );
      return;
    }

    await this.ensureRadiusUser(pelanggan);
    await this.removeUserBandwidth(pelanggan.username, pelanggan.tenantId);
    if (this.shouldAssignGroups(pelanggan.status)) {
      await this.syncPelangganGroups(pelanggan);
    }
  }

  /** Sync Package settings to RADIUS. */
  async syncPackageToRadius(packageId: string): Promise<void> {
    const pkg = await this.findPackageWithRadiusSettings(packageId);
    if (!pkg?.tenantId) return;

    await this.syncPackageBandwidth(pkg);
    await this.syncPackageProfile(pkg);
  }

  /** Sync all packages using a specific bandwidth to RADIUS. */
  async syncBandwidthToRadius(bandwidthId: string): Promise<void> {
    const packages = await this.prisma.hargaPaket.findMany({
      where: { bandwidthId },
    });
    for (const pkg of packages) await this.syncPackageToRadius(pkg.id);
  }

  /** Sync all packages using a specific profile to RADIUS. */
  async syncProfileToRadius(profileId: string): Promise<void> {
    const packages = await this.prisma.hargaPaket.findMany({
      where: { profilePPPId: profileId },
    });
    for (const pkg of packages) await this.syncPackageToRadius(pkg.id);
  }

  /** Sync all packages to RADIUS. */
  async syncAllPackagesToRadius(tenantId?: string): Promise<void> {
    const packages = await this.prisma.hargaPaket.findMany({
      ...(tenantId && { where: { tenantId } }),
    });
    for (const pkg of packages) await this.syncPackageToRadius(pkg.id);
  }

  /** Sync all active customers to RADIUS. */
  async syncAllActiveCustomers(
    tenantId?: string,
  ): Promise<{ created: number; updated: number; deleted: number }> {
    await this.syncAllPackagesToRadius(tenantId);
    const pelanggans = await this.findPelanggansForSync(tenantId);
    const result = { created: 0, updated: 0, deleted: 0 };

    for (const pelanggan of pelanggans) {
      await this.syncCustomerAndCount(pelanggan, result);
    }

    return result;
  }

  private findPelangganWithPackage(pelangganId: string) {
    return this.prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      include: { hargaPaket: { include: { bandwidth: true } } },
    });
  }

  private findPackageWithRadiusSettings(packageId: string) {
    return this.prisma.hargaPaket.findUnique({
      where: { id: packageId },
      include: { bandwidth: true, profilePPP: true },
    });
  }

  private findPelanggansForSync(tenantId?: string) {
    return this.prisma.pelanggan.findMany({
      include: { hargaPaket: { include: { bandwidth: true } } },
      ...(tenantId && { where: { tenantId } }),
    });
  }

  private shouldDeleteRadiusUser(status: string) {
    return status === "NONAKTIF" || status === "DISMANTLE";
  }

  private shouldAssignGroups(status: string) {
    return status === "AKTIF" || status === "ISOLIR";
  }

  private async ensureRadiusUser(pelanggan: {
    username: string;
    password: string;
    tenantId: string;
  }) {
    const exists = await this.operations.userExists(
      pelanggan.username,
      pelanggan.tenantId,
    );
    if (!exists) {
      await this.operations.createRadiusUser(pelanggan, pelanggan.tenantId);
      return;
    }

    await this.operations.updateRadiusPassword(
      pelanggan.username,
      pelanggan.password,
      pelanggan.tenantId,
    );
  }

  private async removeUserBandwidth(username: string, tenantId: string) {
    await this.radiusClient.radreply.deleteMany({
      where: { username, attribute: MIKROTIK_RATE_LIMIT_ATTRIBUTE, tenantId },
    });
  }

  private async syncPelangganGroups(pelanggan: {
    username: string;
    status: string;
    tenantId: string;
    hargaPaket?: { id: string } | null;
  }) {
    const desiredGroups: string[] = [];
    if (pelanggan.hargaPaket) {
      await this.assignPackageGroup(pelanggan, desiredGroups);
    }
    if (pelanggan.status === "ISOLIR") {
      await this.assignIsolirGroup(pelanggan, desiredGroups);
    }
    await this.syncUserGroups(
      pelanggan.username,
      pelanggan.tenantId,
      desiredGroups,
    );
  }

  private async assignPackageGroup(
    pelanggan: {
      username: string;
      tenantId: string;
      hargaPaket?: { id: string } | null;
    },
    desiredGroups: string[],
  ) {
    const packageId = pelanggan.hargaPaket!.id;
    await this.syncPackageToRadius(packageId);
    await this.operations.assignUserToGroup(
      pelanggan.username,
      packageId,
      pelanggan.tenantId,
      PACKAGE_GROUP_PRIORITY,
    );
    desiredGroups.push(packageId);
  }

  private async assignIsolirGroup(
    pelanggan: { username: string; tenantId: string },
    desiredGroups: string[],
  ) {
    await this.operations.setGroupAttribute(
      "ISOLIR",
      MIKROTIK_GROUP_ATTRIBUTE,
      EXPIRED_USERS_PROFILE,
      pelanggan.tenantId,
    );
    await this.operations.removeGroupAttribute(
      "ISOLIR",
      MIKROTIK_RATE_LIMIT_ATTRIBUTE,
      pelanggan.tenantId,
    );
    await this.operations.assignUserToGroup(
      pelanggan.username,
      "ISOLIR",
      pelanggan.tenantId,
      ISOLIR_GROUP_PRIORITY,
    );
    desiredGroups.push("ISOLIR");
  }

  private async syncUserGroups(
    username: string,
    tenantId: string,
    desiredGroups: string[],
  ) {
    const existingGroups = await this.operations.getUserGroups(
      username,
      tenantId,
    );
    const desiredGroupSet = new Set(desiredGroups);
    for (const groupname of existingGroups) {
      if (!desiredGroupSet.has(groupname)) {
        await this.operations.removeUserFromGroup(
          username,
          groupname,
          tenantId,
        );
      }
    }
  }

  private async syncPackageBandwidth(
    pkg: Awaited<
      ReturnType<RadiusSyncRepository["findPackageWithRadiusSettings"]>
    >,
  ) {
    if (pkg?.bandwidth) {
      await this.operations.setGroupBandwidth(
        pkg.id,
        buildMikrotikRateLimit(pkg.bandwidth),
        pkg.tenantId!,
      );
      return;
    }

    await this.operations.removeGroupAttribute(
      pkg!.id,
      MIKROTIK_RATE_LIMIT_ATTRIBUTE,
      pkg!.tenantId!,
    );
  }

  private async syncPackageProfile(
    pkg: Awaited<
      ReturnType<RadiusSyncRepository["findPackageWithRadiusSettings"]>
    >,
  ) {
    if (pkg?.profilePPP) {
      await this.syncExistingPackageProfile(pkg);
      return;
    }

    await this.clearPackageProfile(pkg!.id, pkg!.tenantId!);
  }

  private async syncExistingPackageProfile(
    pkg: NonNullable<
      Awaited<ReturnType<RadiusSyncRepository["findPackageWithRadiusSettings"]>>
    >,
  ) {
    const profile = pkg.profilePPP!;
    await this.syncProfileName(pkg.id, profile.name, pkg.tenantId);
    if (profile.poolMode === "RADIUS") {
      await this.useRadiusPoolMode(pkg.id, profile.remoteAddress, pkg.tenantId);
      return;
    }

    await this.useMikrotikPoolMode(pkg.id, profile.remoteAddress, pkg.tenantId);
  }

  private async syncProfileName(
    packageId: string,
    profileName: string | null,
    tenantId: string,
  ) {
    if (profileName) {
      await this.operations.setGroupAttribute(
        packageId,
        MIKROTIK_GROUP_ATTRIBUTE,
        profileName,
        tenantId,
      );
      return;
    }

    await this.operations.removeGroupAttribute(
      packageId,
      MIKROTIK_GROUP_ATTRIBUTE,
      tenantId,
    );
  }

  private async useRadiusPoolMode(
    packageId: string,
    poolName: string,
    tenantId: string,
  ) {
    await this.operations.setGroupCheckAttribute(
      packageId,
      POOL_NAME_ATTRIBUTE,
      poolName,
      tenantId,
      GROUP_REPLY_ASSIGN_OP,
    );
    await this.operations.removeGroupAttribute(
      packageId,
      FRAMED_POOL_ATTRIBUTE,
      tenantId,
    );
  }

  private async useMikrotikPoolMode(
    packageId: string,
    poolName: string,
    tenantId: string,
  ) {
    await this.operations.setGroupAttribute(
      packageId,
      FRAMED_POOL_ATTRIBUTE,
      poolName,
      tenantId,
    );
    await this.operations.removeGroupCheckAttribute(
      packageId,
      POOL_NAME_ATTRIBUTE,
      tenantId,
    );
  }

  private async clearPackageProfile(packageId: string, tenantId: string) {
    await this.operations.removeGroupAttribute(
      packageId,
      MIKROTIK_GROUP_ATTRIBUTE,
      tenantId,
    );
    await this.operations.removeGroupAttribute(
      packageId,
      FRAMED_POOL_ATTRIBUTE,
      tenantId,
    );
    await this.operations.removeGroupCheckAttribute(
      packageId,
      POOL_NAME_ATTRIBUTE,
      tenantId,
    );
  }

  private async syncCustomerAndCount(
    pelanggan: {
      id: string;
      username: string;
      status: string;
      tenantId: string | null;
    },
    result: { created: number; updated: number; deleted: number },
  ) {
    if (!pelanggan.tenantId) return;
    const exists = await this.operations.userExists(
      pelanggan.username,
      pelanggan.tenantId,
    );

    if (this.shouldAssignGroups(pelanggan.status)) {
      if (exists) result.updated++;
      else result.created++;
      await this.syncPelangganToRadius(pelanggan.id);
      return;
    }

    if (exists) {
      result.deleted++;
      await this.operations.deleteRadiusUser(
        pelanggan.username,
        pelanggan.tenantId,
      );
    }
  }
}
